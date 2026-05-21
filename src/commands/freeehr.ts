import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getEmployees,
  getPayrolls,
  getWorkRecords,
} from '../integrations/freeehr';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('freee人事労務のアクセストークンが未設定です')
    .setDescription('/vault set key:freeehr_access_token value:<token> を実行してください')
    .setColor(0x00c4a7);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const freeehrCommand = {
  data: new SlashCommandBuilder()
    .setName('freeehr')
    .setDescription('freee人事労務の従業員・給与・勤怠を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('employees')
        .setDescription('従業員一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('company_id').setDescription('company ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('payrolls')
        .setDescription('給与一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('company_id').setDescription('company ID').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('year').setDescription('対象年').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('month').setDescription('対象月').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('workrecords')
        .setDescription('勤怠サマリを表示します')
        .addIntegerOption((option) =>
          option.setName('company_id').setDescription('company ID').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('employee_id').setDescription('従業員ID').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('year').setDescription('対象年').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('month').setDescription('対象月').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'freeehr_access_token');

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
        const companyId = interaction.options.getInteger('company_id', true);
        const employees = await getEmployees(token, companyId);
        const embed = new EmbedBuilder()
          .setTitle(`freee HR Employees: ${companyId}`)
          .setColor(0x00c4a7);

        if (employees.length === 0) {
          embed.setDescription('従業員は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              employees.map(
                (employee) =>
                  `**${employee.display_name}**\nID: ${employee.id}\nEntry Date: ${employee.entry_date || '-'}\nDepartment: ${employee.department || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'payrolls') {
        const companyId = interaction.options.getInteger('company_id', true);
        const year = interaction.options.getInteger('year', true);
        const month = interaction.options.getInteger('month', true);
        const payrolls = await getPayrolls(token, companyId, year, month);
        const embed = new EmbedBuilder()
          .setTitle(`freee HR Payrolls: ${companyId} / ${year}-${month}`)
          .setColor(0x00c4a7);

        if (payrolls.length === 0) {
          embed.setDescription('給与情報は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              payrolls.map(
                (payroll) =>
                  `**${payroll.employee_name || '-'}**\nEmployee ID: ${payroll.employee_id}\nTotal Amount: ${payroll.total_amount}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const companyId = interaction.options.getInteger('company_id', true);
      const employeeId = interaction.options.getInteger('employee_id', true);
      const year = interaction.options.getInteger('year', true);
      const month = interaction.options.getInteger('month', true);
      const workRecord = await getWorkRecords(token, companyId, employeeId, year, month);
      const embed = new EmbedBuilder()
        .setTitle(`freee HR Work Records: ${employeeId}`)
        .setColor(0x00c4a7)
        .addFields(
          { name: 'Company ID', value: String(companyId), inline: true },
          { name: 'Year', value: String(year), inline: true },
          { name: 'Month', value: String(month), inline: true },
          {
            name: 'Total Work Mins',
            value: String(workRecord.total_work_mins),
            inline: true,
          },
          {
            name: 'Total Overtime Mins',
            value: String(workRecord.total_overtime_work_mins),
            inline: true,
          }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'freee人事労務連携の処理中にエラーが発生しました。');

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
