import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { createTask, getMe, getMessages, getRooms, sendMessage } from '../integrations/chatwork';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TASK_BODY_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Chatwork APIキーが未設定です')
    .setDescription('/vault set key:chatwork_api_key value:<your-key> を実行してください')
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const chatworkCommand = {
  data: new SlashCommandBuilder()
    .setName('chatwork')
    .setDescription('Chatworkのroom, message, taskを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('rooms').setDescription('room一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('messageを送信します')
        .addIntegerOption((option) =>
          option.setName('room_id').setDescription('Chatwork room ID').setRequired(true)
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
        .addIntegerOption((option) =>
          option.setName('room_id').setDescription('Chatwork room ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('task')
        .setDescription('taskを作成します')
        .addIntegerOption((option) =>
          option.setName('room_id').setDescription('Chatwork room ID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('body')
            .setDescription('task本文')
            .setRequired(true)
            .setMaxLength(MAX_TASK_BODY_LENGTH)
        )
        .addIntegerOption((option) =>
          option.setName('to_id').setDescription('担当者のaccount ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('me').setDescription('自分のaccount情報を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'chatwork_api_key');

      if (!apiKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'rooms') {
        const rooms = await getRooms(apiKey);
        const embed = new EmbedBuilder().setTitle('Chatwork Rooms').setColor(0x06c755);

        if (rooms.length === 0) {
          embed.setDescription('roomは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              rooms.map(
                (room) =>
                  `**${room.name}**\nID: ${room.room_id} / Type: ${room.type} / Unread: ${room.unread_num}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'send') {
        const roomId = interaction.options.getInteger('room_id', true);
        const message = interaction.options.getString('message', true).trim();
        const result = await sendMessage(apiKey, roomId, message);

        const embed = new EmbedBuilder()
          .setTitle('Chatwork messageを送信しました')
          .setColor(0x06c755)
          .addFields(
            { name: 'Room ID', value: String(roomId), inline: true },
            { name: 'Message ID', value: result.message_id, inline: true },
            { name: 'Body', value: truncate(message, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'messages') {
        const roomId = interaction.options.getInteger('room_id', true);
        const messages = await getMessages(apiKey, roomId, true);
        const embed = new EmbedBuilder()
          .setTitle(`Chatwork Messages: ${roomId}`)
          .setColor(0x06c755);

        if (messages.length === 0) {
          embed.setDescription('messageは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              messages.map(
                (message) =>
                  `**${message.account.name}** (${message.message_id})\n${truncate(message.body, 300)}\n送信時刻: ${new Date(
                    message.send_time * 1000
                  ).toISOString()}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'task') {
        const roomId = interaction.options.getInteger('room_id', true);
        const body = interaction.options.getString('body', true).trim();
        const toId = interaction.options.getInteger('to_id', true);
        const result = await createTask(apiKey, roomId, {
          body,
          to_ids: [toId],
        });

        const embed = new EmbedBuilder()
          .setTitle('Chatwork taskを作成しました')
          .setColor(0x06c755)
          .addFields(
            { name: 'Room ID', value: String(roomId), inline: true },
            { name: 'To ID', value: String(toId), inline: true },
            { name: 'Task IDs', value: result.task_id.join(', '), inline: false },
            { name: 'Body', value: truncate(body, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const me = await getMe(apiKey);
      const embed = new EmbedBuilder()
        .setTitle('Chatwork Account')
        .setColor(0x06c755)
        .addFields(
          { name: 'Account ID', value: String(me.account_id), inline: true },
          { name: 'Name', value: me.name || '-', inline: true },
          { name: 'Email', value: me.email || '-', inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Chatwork連携の処理中にエラーが発生しました。');

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
