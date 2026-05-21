import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { testWebhook, triggerZap } from '../integrations/zapier';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_DATA_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Zapier Webhook URLが未設定です')
    .setDescription(
      '/vault set key:zapier_webhook_url value:https://hooks.zapier.com/... を実行するか、webhook_url オプションを指定してください'
    )
    .setColor(0xff4a00);
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

function resolveWebhookUrl(interaction: ChatInputCommandInteraction): string | null {
  return (
    interaction.options.getString('webhook_url')?.trim() ||
    vaultService.getCredential(interaction.user.id, 'user', 'zapier_webhook_url')
  );
}

export const zapierCommand = {
  data: new SlashCommandBuilder()
    .setName('zapier')
    .setDescription('ZapierのWebhookをトリガーして自動化を実行します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('trigger')
        .setDescription('Zapierザップをトリガーします')
        .addStringOption((option) =>
          option.setName('webhook_url').setDescription('Zapier Webhook URL').setRequired(false)
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
        .setName('test')
        .setDescription('Webhook接続テストを実行します')
        .addStringOption((option) =>
          option.setName('webhook_url').setDescription('Zapier Webhook URL').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const webhookUrl = resolveWebhookUrl(interaction);

      if (!webhookUrl) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'trigger') {
        const dataInput = interaction.options.getString('data');
        const data = parseData(dataInput);
        const result = await triggerZap(webhookUrl, data);

        const embed = new EmbedBuilder()
          .setTitle('Zapier Webhook Triggered')
          .setColor(0xff4a00)
          .addFields(
            { name: 'Status', value: result.status, inline: true },
            { name: 'Webhook URL', value: truncate(webhookUrl, 1024), inline: false },
            { name: 'Data', value: truncate(JSON.stringify(data), 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      await testWebhook(webhookUrl);
      const embed = new EmbedBuilder()
        .setTitle('Zapier Webhook Test Succeeded')
        .setColor(0xff4a00)
        .addFields({ name: 'Webhook URL', value: truncate(webhookUrl, 1024), inline: false });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Zapier連携の処理中にエラーが発生しました。');

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
