import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getExpenses, getInvoices, getOffices } from '../integrations/moneyforward';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Money Forward アクセストークンが未設定です')
    .setDescription('/vault set key:moneyforward_access_token value:<token> を実行してください')
    .setColor(0x003087);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const moneyforwardCommand = {
  data: new SlashCommandBuilder()
    .setName('moneyforward')
    .setDescription('Money Forwardの請求書・経費申請を参照します')
    .addSubcommand((subcommand) =>
      subcommand.setName('offices').setDescription('事業所一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('invoices')
        .setDescription('請求書一覧を表示します')
        .addStringOption((option) =>
          option.setName('office_id').setDescription('Money Forward office ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('expenses')
        .setDescription('経費申請一覧を表示します')
        .addStringOption((option) =>
          option.setName('office_id').setDescription('Money Forward office ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'moneyforward_access_token'
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

      if (subcommand === 'offices') {
        const offices = await getOffices(token);
        const embed = new EmbedBuilder().setTitle('Money Forward Offices').setColor(0x003087);

        if (offices.length === 0) {
          embed.setDescription('事業所は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(offices.map((office) => `**${office.name}**\nID: ${office.id}`))
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'invoices') {
        const officeId = interaction.options.getString('office_id', true).trim();
        const invoices = await getInvoices(token, officeId);
        const embed = new EmbedBuilder()
          .setTitle(`Money Forward Invoices: ${officeId}`)
          .setColor(0x003087);

        if (invoices.length === 0) {
          embed.setDescription('請求書は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              invoices.map(
                (invoice) =>
                  `**${invoice.title}**\nID: ${invoice.id}\nStatus: ${invoice.status}\nAmount: ${invoice.amount}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const officeId = interaction.options.getString('office_id', true).trim();
      const expenses = await getExpenses(token, officeId);
      const embed = new EmbedBuilder()
        .setTitle(`Money Forward Expenses: ${officeId}`)
        .setColor(0x003087);

      if (expenses.length === 0) {
        embed.setDescription('経費申請は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            expenses.map(
              (expense) =>
                `**${expense.subject}**\nID: ${expense.id}\nStatus: ${expense.status}\nAmount: ${expense.amount}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Money Forward連携の処理中にエラーが発生しました。');

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
