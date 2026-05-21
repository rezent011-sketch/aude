import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getChannels,
  getMessages,
  getUserInfo,
  sendMessage,
} from '../integrations/slack';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_MESSAGE_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Slack Bot Tokenが未設定です')
    .setDescription('/vault set key:slack_bot_token value:xoxb-... を実行してください')
    .setColor(0x4a154b);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

async function resolveChannelId(token: string, input: string): Promise<string> {
  const normalized = input.trim().replace(/^#/, '');

  if (!normalized) {
    return input;
  }

  if (/^[cgd][a-z0-9]+$/i.test(normalized)) {
    return normalized;
  }

  const channels = await getChannels(token);
  const matched = channels.find((channel) => channel.name === normalized);
  return matched?.id ?? input.trim();
}

export const slackCommand = {
  data: new SlashCommandBuilder()
    .setName('slack')
    .setDescription('Slackのチャンネル・メッセージを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('channels').setDescription('チャンネル一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('メッセージを送信します')
        .addStringOption((option) =>
          option
            .setName('channel')
            .setDescription('チャンネルIDまたは名前')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('送信するメッセージ')
            .setRequired(true)
            .setMaxLength(MAX_MESSAGE_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('messages')
        .setDescription('最近のメッセージ一覧を表示します')
        .addStringOption((option) =>
          option.setName('channel').setDescription('チャンネルIDまたは名前').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('user')
        .setDescription('ユーザー情報を取得します')
        .addStringOption((option) =>
          option.setName('user_id').setDescription('Slack user ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'slack_bot_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'channels') {
        const channels = await getChannels(token);
        const embed = new EmbedBuilder().setTitle('Slack Channels').setColor(0x4a154b);

        if (channels.length === 0) {
          embed.setDescription('チャンネルは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              channels.map(
                (channel) =>
                  `**${channel.name}**\nID: ${channel.id}\nPrivate: ${channel.is_private ? 'yes' : 'no'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'send') {
        const channelInput = interaction.options.getString('channel', true).trim();
        const channel = await resolveChannelId(token, channelInput);
        const message = interaction.options.getString('message', true).trim();
        await sendMessage(token, channel, message);

        const embed = new EmbedBuilder()
          .setTitle('Slackにメッセージを送信しました')
          .setColor(0x4a154b)
          .addFields(
            { name: 'Channel', value: channelInput, inline: true },
            { name: 'Resolved ID', value: channel, inline: true },
            { name: 'Message', value: truncate(message, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'messages') {
        const channelInput = interaction.options.getString('channel', true).trim();
        const channel = await resolveChannelId(token, channelInput);
        const messages = await getMessages(token, channel);
        const embed = new EmbedBuilder()
          .setTitle(`Slack Messages: ${channelInput}`)
          .setColor(0x4a154b)
          .addFields({ name: 'Resolved ID', value: channel, inline: true });

        if (messages.length === 0) {
          embed.setDescription('メッセージは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              messages.map(
                (message) =>
                  `**${message.user}**\nTS: ${message.ts}\n${truncate(message.text, 300)}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const userId = interaction.options.getString('user_id', true).trim();
      const user = await getUserInfo(token, userId);
      const embed = new EmbedBuilder()
        .setTitle('Slack User')
        .setColor(0x4a154b)
        .addFields(
          { name: 'User ID', value: userId, inline: true },
          { name: 'Name', value: user.name || '-', inline: true },
          { name: 'Real Name', value: user.real_name || '-', inline: false },
          { name: 'Email', value: user.email || '-', inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Slack連携の処理中にエラーが発生しました。');

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
