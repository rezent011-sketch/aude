import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  sendEmbedMessage,
  sendWebhookMessage,
} from '../integrations/discordwebhook';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_URL_LENGTH = 2000;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TITLE_LENGTH = 256;
const MAX_USERNAME_LENGTH = 80;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Discord Webhook URLが未設定です')
    .setDescription('/vault set key:discord_webhook_url value:https://discord.com/api/webhooks/... を実行してください')
    .setColor(0x5865f2);
}

function resolveWebhookUrl(interaction: ChatInputCommandInteraction): string | null {
  const optionValue = interaction.options.getString('webhook_url');

  if (optionValue?.trim()) {
    return optionValue.trim();
  }

  return vaultService.getCredential(interaction.user.id, 'user', 'discord_webhook_url');
}

export const discordwebhookCommand = {
  data: new SlashCommandBuilder()
    .setName('discordwebhook')
    .setDescription('外部DiscordサーバーのWebhookにメッセージを送信します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('Webhookへメッセージを送信します')
        .addStringOption((option) =>
          option.setName('webhook_url').setDescription('Discord Webhook URL').setRequired(false).setMaxLength(MAX_URL_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('message').setDescription('送信メッセージ').setRequired(true).setMaxLength(MAX_MESSAGE_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('username').setDescription('送信者名').setRequired(false).setMaxLength(MAX_USERNAME_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('embed')
        .setDescription('WebhookへEmbedを送信します')
        .addStringOption((option) =>
          option.setName('webhook_url').setDescription('Discord Webhook URL').setRequired(false).setMaxLength(MAX_URL_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('title').setDescription('Embedタイトル').setRequired(true).setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('description').setDescription('Embed本文').setRequired(true).setMaxLength(MAX_MESSAGE_LENGTH)
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

      if (subcommand === 'send') {
        const message = interaction.options.getString('message', true).trim();
        const username = interaction.options.getString('username')?.trim();
        await sendWebhookMessage(webhookUrl, message, username);

        const embed = new EmbedBuilder()
          .setTitle('Discord Webhookへ送信しました')
          .setColor(0x5865f2)
          .addFields(
            { name: 'Username', value: username || 'Aude', inline: true },
            { name: 'Message', value: truncate(message, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const title = interaction.options.getString('title', true).trim();
      const description = interaction.options.getString('description', true).trim();
      await sendEmbedMessage(webhookUrl, title, description);

      const embed = new EmbedBuilder()
        .setTitle('Discord WebhookへEmbedを送信しました')
        .setColor(0x5865f2)
        .addFields(
          { name: 'Title', value: title, inline: false },
          { name: 'Description', value: truncate(description, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Discord Webhook連携の処理中にエラーが発生しました。');

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
