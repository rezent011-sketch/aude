import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createMeeting, getAccessToken, getMeeting, listMeetings } from '../integrations/zoom';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_TOPIC_LENGTH = 200;
const MAX_AGENDA_LENGTH = 2000;
const DEFAULT_ZOOM_USER_ID = 'me';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Zoom認証情報が未設定です')
    .setDescription('/vault set で zoom_account_id, zoom_client_id, zoom_client_secret を設定してください')
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

async function getZoomTokenForUser(userId: string): Promise<{ token: string; zoomUserId: string }> {
  const accountId = vaultService.getCredential(userId, 'user', 'zoom_account_id');
  const clientId = vaultService.getCredential(userId, 'user', 'zoom_client_id');
  const clientSecret = vaultService.getCredential(userId, 'user', 'zoom_client_secret');
  const zoomUserId =
    vaultService.getCredential(userId, 'user', 'zoom_user_id')?.trim() || DEFAULT_ZOOM_USER_ID;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('MISSING_ZOOM_CREDENTIALS');
  }

  const token = await getAccessToken(accountId, clientId, clientSecret);
  return { token, zoomUserId };
}

export const zoomCommand = {
  data: new SlashCommandBuilder()
    .setName('zoom')
    .setDescription('Zoom meetingを操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('meetingを作成します')
        .addStringOption((option) =>
          option
            .setName('topic')
            .setDescription('meeting topic')
            .setRequired(true)
            .setMaxLength(MAX_TOPIC_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('duration')
            .setDescription('duration in minutes')
            .setRequired(false)
            .setMinValue(1)
        )
        .addStringOption((option) =>
          option
            .setName('start_time')
            .setDescription("開始時刻 例: 2026-05-21T10:00:00")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('agenda')
            .setDescription('meeting agenda')
            .setRequired(false)
            .setMaxLength(MAX_AGENDA_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('scheduled meeting一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('meeting情報を表示します')
        .addStringOption((option) =>
          option.setName('meeting_id').setDescription('Zoom meeting ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const hasCredentials =
        vaultService.getCredential(interaction.user.id, 'user', 'zoom_account_id') &&
        vaultService.getCredential(interaction.user.id, 'user', 'zoom_client_id') &&
        vaultService.getCredential(interaction.user.id, 'user', 'zoom_client_secret');

      if (!hasCredentials) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { token, zoomUserId } = await getZoomTokenForUser(interaction.user.id);

      if (subcommand === 'create') {
        const topic = interaction.options.getString('topic', true).trim();
        const duration = interaction.options.getInteger('duration') ?? 30;
        const startTime = interaction.options.getString('start_time')?.trim();
        const agenda = interaction.options.getString('agenda')?.trim();
        const meeting = await createMeeting(token, zoomUserId, {
          topic,
          duration,
          start_time: startTime,
          agenda,
        });

        const embed = new EmbedBuilder()
          .setTitle('Zoom meetingを作成しました')
          .setColor(0x2d8cff)
          .setDescription(`**Join URL**\n${meeting.join_url || '-'}`)
          .addFields(
            { name: 'Meeting ID', value: String(meeting.id), inline: true },
            { name: 'Topic', value: meeting.topic, inline: true },
            { name: 'Start Time', value: meeting.start_time || '-', inline: false },
            { name: 'Start URL', value: meeting.start_url || '-', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'list') {
        const meetings = await listMeetings(token, zoomUserId);
        const embed = new EmbedBuilder().setTitle('Zoom Scheduled Meetings').setColor(0x2d8cff);

        if (meetings.length === 0) {
          embed.setDescription('scheduled meetingは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              meetings.map(
                (meeting) =>
                  `**${meeting.topic}**\nID: ${meeting.id} / Start: ${meeting.start_time || '-'} / Duration: ${meeting.duration}分\n${meeting.join_url || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const meetingId = interaction.options.getString('meeting_id', true).trim();
      const meeting = await getMeeting(token, meetingId);
      const embed = new EmbedBuilder()
        .setTitle('Zoom Meeting Info')
        .setColor(0x2d8cff)
        .setDescription(`**Join URL**\n${meeting.join_url || '-'}`)
        .addFields(
          { name: 'Meeting ID', value: String(meeting.id), inline: true },
          { name: 'Topic', value: meeting.topic, inline: true },
          { name: 'Start Time', value: meeting.start_time || '-', inline: false },
          { name: 'Duration', value: `${meeting.duration}分`, inline: true },
          { name: 'Agenda', value: truncate(meeting.agenda || '-', 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error instanceof Error && error.message === 'MISSING_ZOOM_CREDENTIALS') {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [buildCredentialGuideEmbed()] });
          return;
        }

        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const message = getErrorMessage(error, 'Zoom連携の処理中にエラーが発生しました。');

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
