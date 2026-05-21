import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getWorkflows, triggerWorkflow } from '../integrations/n8n';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_DATA_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('n8n認証情報が未設定です')
    .setDescription(
      '/vault set key:n8n_api_key value:<token> と /vault set key:n8n_base_url value:https://your-n8n.example.com を実行してください'
    )
    .setColor(0xea4b71);
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

export const n8nCommand = {
  data: new SlashCommandBuilder()
    .setName('n8n')
    .setDescription('n8nのワークフローをトリガーします')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('trigger')
        .setDescription('Webhookでワークフローをトリガーします')
        .addStringOption((option) =>
          option.setName('webhook_url').setDescription('n8n Webhook URL').setRequired(true)
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
        .setName('workflows')
        .setDescription('ワークフロー一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('base_url')
            .setDescription('n8nのベースURL、省略時はvaultから取得')
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'n8n_api_key');
      const vaultBaseUrl = vaultService.getCredential(interaction.user.id, 'user', 'n8n_base_url');

      if (subcommand === 'workflows' && (!apiKey || !(interaction.options.getString('base_url')?.trim() || vaultBaseUrl))) {
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
        const result = await triggerWorkflow(webhookUrl, data);

        const embed = new EmbedBuilder()
          .setTitle('n8n Workflow Triggered')
          .setColor(0xea4b71)
          .addFields(
            { name: 'Webhook URL', value: truncate(webhookUrl, 1024), inline: false },
            { name: 'Data', value: truncate(JSON.stringify(data), 1024), inline: false },
            {
              name: 'Response',
              value: truncate(
                typeof result === 'string' ? result : JSON.stringify(result),
                1024
              ) || '-',
              inline: false,
            }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const baseUrl = interaction.options.getString('base_url')?.trim() || vaultBaseUrl || '';
      const workflows = await getWorkflows(baseUrl, apiKey as string);
      const embed = new EmbedBuilder().setTitle('n8n Workflows').setColor(0xea4b71);

      if (workflows.length === 0) {
        embed.setDescription('ワークフローは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            workflows.map(
              (workflow) =>
                `**${workflow.name}**\nID: ${workflow.id}\nActive: ${workflow.active ? 'yes' : 'no'}\nCreated: ${workflow.createdAt || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'n8n連携の処理中にエラーが発生しました。');

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
