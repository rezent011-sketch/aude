import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  clockIn,
  clockOut,
  getAttendance,
  getStaffList,
} from '../integrations/jobcan';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Jobcan APIトークンが未設定です')
    .setDescription('/vault set key:jobcan_api_token value:<token> を実行してください')
    .setColor(0x00a0e9);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const jobcanCommand = {
  data: new SlashCommandBuilder()
    .setName('jobcan')
    .setDescription('Jobcanで出退勤打刻・勤怠データを管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clockin')
        .setDescription('出勤打刻')
        .addStringOption((option) =>
          option.setName('note').setDescription('備考').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('clockout')
        .setDescription('退勤打刻')
        .addStringOption((option) =>
          option.setName('note').setDescription('備考').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('staff').setDescription('スタッフ一覧表示')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('attendance')
        .setDescription('勤怠データ確認')
        .addIntegerOption((option) =>
          option.setName('staff_id').setDescription('スタッフID').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('year').setDescription('年').setRequired(false)
        )
        .addIntegerOption((option) =>
          option.setName('month').setDescription('月').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'jobcan_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'clockin') {
        const note = interaction.options.getString('note')?.trim();
        await clockIn(token, note);

        const embed = new EmbedBuilder()
          .setTitle('Jobcanで出勤打刻しました')
          .setColor(0x00a0e9)
          .setDescription(note ? `備考: ${truncate(note, 4000)}` : '備考なし');

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'clockout') {
        const note = interaction.options.getString('note')?.trim();
        await clockOut(token, note);

        const embed = new EmbedBuilder()
          .setTitle('Jobcanで退勤打刻しました')
          .setColor(0x00a0e9)
          .setDescription(note ? `備考: ${truncate(note, 4000)}` : '備考なし');

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'staff') {
        const staffs = await getStaffList(token);
        const embed = new EmbedBuilder().setTitle('Jobcan Staff List').setColor(0x00a0e9);

        if (staffs.length === 0) {
          embed.setDescription('スタッフは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              staffs.map(
                (staff) => `**${staff.name}**\nID: ${staff.id}\nGroup: ${staff.group_name}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const staffId = interaction.options.getInteger('staff_id', true);
      const now = new Date();
      const year = interaction.options.getInteger('year') ?? now.getFullYear();
      const month = interaction.options.getInteger('month') ?? now.getMonth() + 1;
      const attendances = await getAttendance(token, staffId, year, month);
      const embed = new EmbedBuilder()
        .setTitle(`Jobcan Attendance: ${staffId}`)
        .setColor(0x00a0e9)
        .addFields(
          { name: 'Year', value: String(year), inline: true },
          { name: 'Month', value: String(month), inline: true }
        );

      if (attendances.length === 0) {
        embed.setDescription('勤怠データは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            attendances.map(
              (attendance) =>
                `**${attendance.date || '-'}**\nWork Time: ${attendance.work_time || '-'}\nEarly OT: ${attendance.early_over_time || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Jobcan連携の処理中にエラーが発生しました。');

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
