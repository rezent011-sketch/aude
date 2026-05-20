import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createRecord,
  getApps,
  getRecords,
  searchRecords,
} from '../integrations/kintone';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_QUERY_LENGTH = 500;
const MAX_FIELD_LENGTH = 100;
const MAX_VALUE_LENGTH = 200;
const MAX_JSON_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('kintone認証情報が未設定です')
    .setDescription('/vault set で kintone_subdomain と kintone_api_token を設定してください')
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatFieldValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '[Unserializable value]';
  }
}

function formatRecordPreview(record: Record<string, { value: unknown }>): string {
  const lines = Object.entries(record)
    .slice(0, 6)
    .map(([key, field]) => `${key}: ${truncate(formatFieldValue(field.value), 120)}`);

  return lines.length > 0 ? lines.join('\n') : 'フィールドなし';
}

function parseRecordJson(input: string): Record<string, { value: unknown }> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(
      `fields はJSONで指定してください。例: {"title":{"value":"test"}} (${getErrorMessage(
        error,
        'JSON parse error'
      )})`
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('fields は {"fieldCode":{"value":"..."}} 形式のJSON objectで指定してください。');
  }

  const record = parsed as Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !('value' in value)) {
      throw new Error('kintoneのfield値は {"fieldCode":{"value":"..."}} 形式で指定してください。');
    }
  }

  return record as Record<string, { value: unknown }>;
}

export const kintoneCommand = {
  data: new SlashCommandBuilder()
    .setName('kintone')
    .setDescription('kintoneのappとrecordを操作します。field値は {"field":{"value":"text"}} 形式です')
    .addSubcommand((subcommand) =>
      subcommand.setName('apps').setDescription('app一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('records')
        .setDescription('record一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('app_id').setDescription('kintone app ID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('kintone query (任意)')
            .setRequired(false)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('recordを作成します。fieldsは {"field":{"value":"text"}} 形式です')
        .addIntegerOption((option) =>
          option.setName('app_id').setDescription('kintone app ID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('fields')
            .setDescription('JSON例: {"title":{"value":"test"}}')
            .setRequired(true)
            .setMaxLength(MAX_JSON_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('fieldでrecord検索します')
        .addIntegerOption((option) =>
          option.setName('app_id').setDescription('kintone app ID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('field')
            .setDescription('検索するfield code')
            .setRequired(true)
            .setMaxLength(MAX_FIELD_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('value')
            .setDescription('検索値')
            .setRequired(true)
            .setMaxLength(MAX_VALUE_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subdomain = vaultService.getCredential(interaction.user.id, 'user', 'kintone_subdomain');
      const apiToken = vaultService.getCredential(interaction.user.id, 'user', 'kintone_api_token');

      if (!subdomain || !apiToken) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'apps') {
        const apps = await getApps(subdomain, apiToken);
        const embed = new EmbedBuilder().setTitle('kintone Apps').setColor(0x00a3ad);

        if (apps.length === 0) {
          embed.setDescription('appは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              apps.map((app) => `**${app.name}**\nApp ID: ${app.appId}\n${app.description}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'records') {
        const appId = interaction.options.getInteger('app_id', true);
        const query = interaction.options.getString('query')?.trim();
        const result = await getRecords(subdomain, apiToken, appId, query);
        const embed = new EmbedBuilder()
          .setTitle(`kintone Records: ${appId}`)
          .setColor(0x00a3ad)
          .addFields({ name: 'Total Count', value: result.totalCount, inline: true });

        if (query) {
          embed.addFields({ name: 'Query', value: truncate(query, 1024), inline: false });
        }

        if (result.records.length === 0) {
          embed.setDescription('recordは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              result.records
                .slice(0, 10)
                .map((record, index) => `**Record ${index + 1}**\n${formatRecordPreview(record)}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create') {
        const appId = interaction.options.getInteger('app_id', true);
        const fields = interaction.options.getString('fields', true).trim();
        const record = parseRecordJson(fields);
        const created = await createRecord(subdomain, apiToken, appId, record);
        const embed = new EmbedBuilder()
          .setTitle('kintone recordを作成しました')
          .setColor(0x57f287)
          .addFields(
            { name: 'App ID', value: String(appId), inline: true },
            { name: 'Record ID', value: created.id, inline: true }
          )
          .setDescription(`\`\`\`json\n${truncate(JSON.stringify(record, null, 2), 3900)}\n\`\`\``);

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const appId = interaction.options.getInteger('app_id', true);
      const field = interaction.options.getString('field', true).trim();
      const value = interaction.options.getString('value', true).trim();
      const records = await searchRecords(subdomain, apiToken, appId, field, value);
      const embed = new EmbedBuilder()
        .setTitle(`kintone Search: ${appId}`)
        .setColor(0x00a3ad)
        .addFields(
          { name: 'Field', value: field, inline: true },
          { name: 'Value', value: truncate(value, 1024), inline: true }
        );

      if (records.length === 0) {
        embed.setDescription('一致するrecordは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            records
              .slice(0, 10)
              .map((record, index) => `**Record ${index + 1}**\n${formatRecordPreview(record)}`)
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'kintone連携の処理中にエラーが発生しました。');

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `⚠️ ${message}` });
        return;
      }

      await interaction.reply({
        content: `⚠️ ${message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
