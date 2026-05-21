import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage, IntegrationError } from '../integrations/errors';
import { createRecord, listBases, listRecords } from '../integrations/airtable';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Airtable APIトークンが未設定です')
    .setDescription('/vault set key:airtable_api_token value:<token> を実行してください')
    .setColor(0xffbf00);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatFields(fields: Record<string, unknown>): string {
  return truncate(JSON.stringify(fields, null, 2) || '{}', 1000);
}

export const airtableCommand = {
  data: new SlashCommandBuilder()
    .setName('airtable')
    .setDescription('Airtableのベース・レコードを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('bases').setDescription('ベース一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('records')
        .setDescription('レコード一覧を表示します')
        .addStringOption((option) =>
          option.setName('base_id').setDescription('Airtable Base ID').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('table').setDescription('Table IDまたは名前').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('レコードを作成します')
        .addStringOption((option) =>
          option.setName('base_id').setDescription('Airtable Base ID').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('table').setDescription('Table IDまたは名前').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('data')
            .setDescription('JSON形式のフィールドデータ')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'airtable_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'bases') {
        const bases = await listBases(token);
        const embed = new EmbedBuilder().setTitle('Airtable Bases').setColor(0xffbf00);

        if (bases.length === 0) {
          embed.setDescription('ベースは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              bases.map(
                (base) =>
                  `**${base.name}**\nID: ${base.id}\nPermission: ${base.permissionLevel}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'records') {
        const baseId = interaction.options.getString('base_id', true).trim();
        const table = interaction.options.getString('table', true).trim();
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const records = await listRecords(token, baseId, table, limit);
        const embed = new EmbedBuilder()
          .setTitle('Airtable Records')
          .setColor(0xffbf00)
          .addFields(
            { name: 'Base ID', value: baseId, inline: true },
            { name: 'Table', value: table, inline: true },
            { name: 'Limit', value: String(limit ?? 20), inline: true }
          );

        if (records.length === 0) {
          embed.setDescription('レコードは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              records.map(
                (record) =>
                  `**${record.id}**\nCreated: ${record.createdTime || '-'}\nFields: \`${truncate(JSON.stringify(record.fields), 250)}\``
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const baseId = interaction.options.getString('base_id', true).trim();
      const table = interaction.options.getString('table', true).trim();
      const data = interaction.options.getString('data', true).trim();

      let fields: Record<string, unknown>;

      try {
        const parsed = JSON.parse(data) as unknown;

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('invalid');
        }

        fields = parsed as Record<string, unknown>;
      } catch {
        throw new IntegrationError('data はJSONオブジェクト形式で指定してください。');
      }

      const record = await createRecord(token, baseId, table, fields);
      const embed = new EmbedBuilder()
        .setTitle('Airtableレコードを作成しました')
        .setColor(0xffbf00)
        .addFields(
          { name: 'Base ID', value: baseId, inline: true },
          { name: 'Table', value: table, inline: true },
          { name: 'Record ID', value: record.id || '-', inline: true },
          { name: 'Fields', value: `\`\`\`json\n${formatFields(record.fields)}\n\`\`\``, inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Airtable連携の処理中にエラーが発生しました。');

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
