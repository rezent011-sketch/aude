import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getDailyAttendance,
  getEmployees,
  getMonthlyAttendance,
} from '../integrations/kingofthyme';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('KING OF TIME APIトークンが未設定です')
    .setDescription('/vault set key:kingofthyme_api_token value:<token> を実行してください')
    .setColor(0xe60012);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatTodayInTokyo(): string {
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function getCurrentTokyoYearMonth(): { year: number; month: number } {
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '1');
  return { year, month };
}

export const kingofthymeCommand = {
  data: new SlashCommandBuilder()
    .setName('kingofthyme')
    .setDescription('KING OF TIMEで勤怠データを確認します')
    .addSubcommand((subcommand) =>
      subcommand.setName('employees').setDescription('従業員一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('daily')
        .setDescription('日次勤怠一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('date')
            .setDescription('日付 YYYY-MM-DD、省略時は今日')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('monthly')
        .setDescription('月次勤怠を表示します')
        .addStringOption((option) =>
          option.setName('employee_id').setDescription('従業員ID').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('year').setDescription('年 YYYY').setRequired(false)
        )
        .addIntegerOption((option) =>
          option.setName('month').setDescription('月 1-12').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'kingofthyme_api_token'
      );

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'employees') {
        const employees = await getEmployees(token);
        const embed = new EmbedBuilder().setTitle('KING OF TIME 従業員一覧').setColor(0xe60012);

        if (employees.length === 0) {
          embed.setDescription('従業員は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              employees
                .slice(0, 10)
                .map(
                  (employee) =>
                    `**${employee.name}**\nEmployee ID: ${employee.employee_id}\nGroup: ${employee.group_name}`
                )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'daily') {
        const date = interaction.options.getString('date')?.trim() || formatTodayInTokyo();
        const attendances = await getDailyAttendance(token, date);
        const embed = new EmbedBuilder()
          .setTitle(`KING OF TIME 日次勤怠: ${date}`)
          .setColor(0xe60012);

        if (attendances.length === 0) {
          embed.setDescription('勤怠データは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              attendances.slice(0, 10).map(
                (attendance) =>
                  `**${attendance.name}**\nEmployee ID: ${attendance.employee_id}\nClock In: ${attendance.clock_in || '-'} / Clock Out: ${attendance.clock_out || '-'}\nWork Time: ${attendance.work_time || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const employeeId = interaction.options.getString('employee_id', true).trim();
      const current = getCurrentTokyoYearMonth();
      const year = interaction.options.getInteger('year') ?? current.year;
      const month = interaction.options.getInteger('month') ?? current.month;
      const attendances = await getMonthlyAttendance(token, employeeId, year, month);
      const embed = new EmbedBuilder()
        .setTitle(`KING OF TIME 月次勤怠: ${employeeId}`)
        .setColor(0xe60012)
        .addFields(
          { name: 'Year', value: String(year), inline: true },
          { name: 'Month', value: String(month), inline: true }
        );

      if (attendances.length === 0) {
        embed.setDescription('勤怠データは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            attendances
              .slice(0, 15)
              .map(
                (attendance) => `**${attendance.date || '-'}**\nWork Time: ${attendance.work_time || '-'}`
              )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'KING OF TIME連携の処理中にエラーが発生しました。');

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
