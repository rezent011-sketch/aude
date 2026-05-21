import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getChannels, getMessages, sendMessage } from '../integrations/lineworks';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_MESSAGE_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('LINE WORKS認証情報が未設定です')
    .setDescription(
      '/vault set で `lineworks_access_token` と `lineworks_bot_id` を設定してください'
    )
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const lineworksCommand = {
  data: new SlashCommandBuilder()
    .setName('lineworks')
    .setDescription('LINE WORKSのchannelとmessageを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('channels').setDescription('channel一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('messageを送信します')
        .addStringOption((option) =>
          option.setName('channel_id').setDescription('LINE WORKS channel ID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('送信するmessage')
            .setRequired(true)
            .setMaxLength(MAX_MESSAGE_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('messages')
        .setDescription('最近のmessageを表示します')
        .addStringOption((option) =>
          option.setName('channel_id').setDescription('LINE WORKS channel ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const accessToken = vaultService.getCredential(
        interaction.user.id,
        'user',
        'lineworks_access_token'
      );
      const botId = vaultService.getCredential(interaction.user.id, 'user', 'lineworks_bot_id');

      if (!accessToken || !botId) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'channels') {
        const channels = await getChannels(accessToken, botId);
        const embed = new EmbedBuilder().setTitle('LINE WORKS Channels').setColor(0x06c755);

        if (channels.length === 0) {
          embed.setDescription('channelは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              channels.map(
                (channel) =>
                  `**${channel.channelName}**\nID: ${channel.channelId} / Type: ${channel.type}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'send') {
        const channelId = interaction.options.getString('channel_id', true).trim();
        const message = interaction.options.getString('message', true).trim();
        await sendMessage(accessToken, botId, channelId, message);

        const embed = new EmbedBuilder()
          .setTitle('LINE WORKS messageを送信しました')
          .setColor(0x06c755)
          .addFields(
            { name: 'Channel ID', value: channelId, inline: true },
            { name: 'Body', value: truncate(message, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const channelId = interaction.options.getString('channel_id', true).trim();
      const messages = await getMessages(accessToken, botId, channelId);
      const embed = new EmbedBuilder()
        .setTitle(`LINE WORKS Messages: ${channelId}`)
        .setColor(0x06c755);

      if (messages.length === 0) {
        embed.setDescription('messageは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            messages.map(
              (message) =>
                `**${message.messageId || '(No ID)'}**\n${truncate(message.text || '(No text)', 300)}\n送信時刻: ${
                  message.createdTime || 'unknown'
                }`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'LINE WORKS連携の処理中にエラーが発生しました。');

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
