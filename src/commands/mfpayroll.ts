import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getEmployees, getPayslips } from '../integrations/mfpayroll';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Money Forwardクラウド給与のアクセストークンが未設定です')
    .setDescription('/vault set key:mfpayroll_access_token value:<token> を実行してください')
    .setColor(0x003087);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function getDefaultYearMonth(): { year: number; month: number } {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export const mfpayrollCommand = {
  data: new SlashCommandBuilder()
    .setName('mfpayroll')
    .setDescription('Money Forwardクラウド給与の従業員・給与明細を確認します')
    .addSubcommand((subcommand) =>
      subcommand.setName('employees').setDescription('従業員一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('payslips')
        .setDescription('給与明細一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('year').setDescription('対象年').setRequired(false)
        )
        .addIntegerOption((option) =>
          option.setName('month').setDescription('対象月').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'mfpayroll_access_token'
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
        const embed = new EmbedBuilder()
          .setTitle('Money Forward Payroll Employees')
          .setColor(0x003087);

        if (employees.length === 0) {
          embed.setDescription('従業員は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              employees.map(
                (employee) =>
                  `**${employee.display_name}**\nID: ${employee.id}\nDepartment: ${employee.department_name || '-'}\nEmployment Type: ${employee.employment_type || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const defaultYearMonth = getDefaultYearMonth();
      const year = interaction.options.getInteger('year') ?? defaultYearMonth.year;
      const month = interaction.options.getInteger('month') ?? defaultYearMonth.month;
      const payslips = await getPayslips(token, year, month);
      const embed = new EmbedBuilder()
        .setTitle(`Money Forward Payroll Payslips: ${year}-${month}`)
        .setColor(0x003087);

      if (payslips.length === 0) {
        embed.setDescription('給与明細は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            payslips.map(
              (payslip) =>
                `**${payslip.employee_name || '-'}**\nEmployee ID: ${payslip.employee_id}\nNet Amount: ${payslip.net_amount}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Money Forwardクラウド給与連携の処理中にエラーが発生しました。'
      );

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
