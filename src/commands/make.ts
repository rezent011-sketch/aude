import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getScenarios, triggerScenario } from '../integrations/make';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_DATA_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Make APIキーが未設定です')
    .setDescription('/vault set key:make_api_key value:<token> を実行してください')
    .setColor(0x6d00cc);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function parseData(input: string | null): Record<string, unknown> {
  if (!input) {
    return {};
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export const makeCommand = {
  data: new SlashCommandBuilder()
    .setName('make')
    .setDescription('Make（旧Integromat）のシナリオをトリガーします')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('trigger')
        .setDescription('Webhookでシナリオをトリガーします')
        .addStringOption((option) =>
          option.setName('webhook_url').setDescription('Make Webhook URL').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('data')
            .setDescription('JSON形式の追加データ')
            .setRequired(false)
            .setMaxLength(MAX_DATA_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('scenarios')
        .setDescription('シナリオ一覧を表示します')
        .addStringOption((option) =>
          option.setName('team_id').setDescription('Make team ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'make_api_key');

      if (subcommand === 'scenarios' && !apiKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'trigger') {
        const webhookUrl = interaction.options.getString('webhook_url', true).trim();
        const data = parseData(interaction.options.getString('data'));
        const result = await triggerScenario(webhookUrl, data);

        const embed = new EmbedBuilder()
          .setTitle('Make Scenario Triggered')
          .setColor(0x6d00cc)
          .addFields(
            { name: 'Accepted', value: result.accepted ? 'yes' : 'no', inline: true },
            { name: 'Webhook URL', value: truncate(webhookUrl, 1024), inline: false },
            { name: 'Data', value: truncate(JSON.stringify(data), 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const teamId = interaction.options.getString('team_id', true).trim();
      const scenarios = await getScenarios(apiKey as string, teamId);
      const embed = new EmbedBuilder()
        .setTitle(`Make Scenarios: ${teamId}`)
        .setColor(0x6d00cc);

      if (scenarios.length === 0) {
        embed.setDescription('シナリオは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            scenarios.map(
              (scenario) =>
                `**${scenario.name}**\nID: ${String(scenario.id)}\nActive: ${scenario.isActive ? 'yes' : 'no'}\nLast Edit: ${scenario.lastEdit || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Make連携の処理中にエラーが発生しました。');

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
