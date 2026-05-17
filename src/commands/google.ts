import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import {
  addCalendarEvent,
  formatCalendarDateTime,
  listTodayCalendarEvents,
} from '../integrations/google';
import { getErrorMessage } from '../integrations/errors';
import { splitMessage, truncate } from '../utils/discord';

const MAX_TITLE_LENGTH = 200;
const MAX_DATETIME_LENGTH = 100;

export const googleCommand = {
  data: new SlashCommandBuilder()
    .setName('google')
    .setDescription('Googleサービスと連携します')
    .addSubcommandGroup((group) =>
      group
        .setName('calendar')
        .setDescription('Google Calendarを操作します')
        .addSubcommand((subcommand) =>
          subcommand
            .setName('list')
            .setDescription('今日のGoogle Calendarイベントを表示します')
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName('add')
            .setDescription('Google Calendarにイベントを追加します')
            .addStringOption((option) =>
              option
                .setName('title')
                .setDescription('イベントタイトル')
                .setRequired(true)
                .setMaxLength(MAX_TITLE_LENGTH)
            )
            .addStringOption((option) =>
              option
                .setName('datetime')
                .setDescription('開始日時。例: 2026-05-17 14:00')
                .setRequired(true)
                .setMaxLength(MAX_DATETIME_LENGTH)
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const group = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (group !== 'calendar') {
        throw new Error('未対応のGoogle連携です。');
      }

      if (subcommand === 'list') {
        const events = await listTodayCalendarEvents();

        if (events.length === 0) {
          await interaction.editReply('今日のGoogle Calendarイベントはありません。');
          return;
        }

        const content = [
          `今日のGoogle Calendarイベント: ${events.length}件`,
          ...events.map((event, index) =>
            [
              `${index + 1}. ${truncate(event.title, 120)}`,
              `開始: ${formatCalendarDateTime(event.start)}`,
              `終了: ${formatCalendarDateTime(event.end)}`,
              event.url ?? 'URLなし',
            ].join('\n')
          ),
        ].join('\n\n');
        const parts = splitMessage(content, 1900);

        await interaction.editReply(parts[0]);

        for (let index = 1; index < parts.length; index += 1) {
          await interaction.followUp({
            content: parts[index],
            flags: MessageFlags.Ephemeral,
          });
        }

        return;
      }

      if (subcommand !== 'add') {
        throw new Error('未対応のGoogle Calendar操作です。');
      }

      const title = interaction.options.getString('title', true).trim();
      const dateTime = interaction.options.getString('datetime', true).trim();
      const event = await addCalendarEvent(title, dateTime);

      await interaction.editReply(
        [
          'Google Calendarにイベントを追加しました。',
          `タイトル: ${event.title}`,
          `開始: ${formatCalendarDateTime(event.start)}`,
          `終了: ${formatCalendarDateTime(event.end)}`,
          event.url ?? 'URLなし',
        ].join('\n')
      );
    } catch (error) {
      const message = getErrorMessage(error, 'Google連携の処理中にエラーが発生しました。');

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`⚠️ ${message}`);
        return;
      }

      await interaction.reply({
        content: `⚠️ ${message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
