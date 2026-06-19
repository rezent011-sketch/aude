import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import scheduleService from '../services/scheduleService';
import { splitMessage, truncate } from '../utils/discord';

const MAX_TASK_LENGTH = 1000;
const LIST_EMPTY_MESSAGE = '登録されているスケジュールはありません。';
const TIMEZONE = process.env.SCHEDULE_TIMEZONE ?? 'Asia/Tokyo';

function formatDateTime(value: string | null): string {
  if (!value) {
    return '未設定';
  }

  return new Date(value).toLocaleString('ja-JP', {
    hour12: false,
    timeZone: TIMEZONE,
  });
}

function requireGuildContext(
  interaction: ChatInputCommandInteraction
): { guildId: string; channelId: string } {
  if (!interaction.guildId || !interaction.channelId) {
    throw new Error('このコマンドはサーバーチャンネルでのみ利用できます。');
  }

  return {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  };
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'スケジュール処理中にエラーが発生しました。しばらくしてから再度お試しください。';
}

export const scheduleCommand = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('定期メッセージを登録・管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('自然言語またはcron式でスケジュールを登録します')
        .addStringOption((option) =>
          option
            .setName('when')
            .setDescription('例: 毎日9時 / 毎週月曜10時 / 0 9 * * *')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('task')
            .setDescription('定期実行時に送信するメッセージ')
            .setRequired(true)
            .setMaxLength(MAX_TASK_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('登録済みスケジュールを一覧表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('スケジュールを削除します')
        .addIntegerOption((option) =>
          option.setName('id').setDescription('削除するスケジュールID').setRequired(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const { guildId, channelId } = requireGuildContext(interaction);
      const subcommand = interaction.options.getSubcommand();
      const discordUserId = interaction.user.id;
      const username = interaction.user.username;

      if (subcommand === 'add') {
        const when = interaction.options.getString('when', true).trim();
        const task = interaction.options.getString('task', true).trim();
        const parsed = scheduleService.parseScheduleInput(when);
        const schedule = scheduleService.addSchedule({
          discordUserId,
          username,
          guildId,
          channelId,
          schedule: when,
          task,
        });

        await interaction.reply({
          content: [
            `✅ スケジュール #${schedule.id} を登録しました。`,
            `指定: ${when}`,
            `cron式: \`${parsed.cronExpr}\``,
            `内容: ${truncate(schedule.task, 200)}`,
            `次回実行予定: ${formatDateTime(schedule.nextRun)}`,
          ].join('\n'),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === 'list') {
        const schedules = scheduleService.listSchedules(discordUserId, username, guildId);
        const content =
          schedules.length === 0
            ? LIST_EMPTY_MESSAGE
            : [
                `登録済みスケジュール一覧（${schedules.length}件）`,
                ...schedules.map((schedule) =>
                  [
                    `#${schedule.id} [${schedule.isActive ? '有効' : '停止中'}]`,
                    `cron: \`${schedule.cronExpr}\``,
                    `内容: ${truncate(schedule.task, 140)}`,
                    `前回: ${formatDateTime(schedule.lastRun)}`,
                    `次回: ${formatDateTime(schedule.nextRun)}`,
                  ].join('\n')
                ),
              ].join('\n\n');
        const parts = splitMessage(content, 1900);

        await interaction.reply({
          content: parts[0],
          flags: MessageFlags.Ephemeral,
        });

        for (let i = 1; i < parts.length; i += 1) {
          await interaction.followUp({
            content: parts[i],
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      const id = interaction.options.getInteger('id', true);
      const deleted = scheduleService.deleteSchedule(id, discordUserId, username, guildId);
      await interaction.reply({
        content: `🗑️ スケジュール #${deleted.id} を削除しました。`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      const message = toUserErrorMessage(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
