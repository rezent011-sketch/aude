import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createJournalEntry,
  getJournalEntries,
  getTrialBalance,
} from '../integrations/yayoi';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('弥生会計 アクセストークンが未設定です')
    .setDescription('/vault set key:yayoi_access_token value:<token> を実行してください')
    .setColor(0x0078d4);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const yayoiCommand = {
  data: new SlashCommandBuilder()
    .setName('yayoi')
    .setDescription('弥生会計の仕訳・試算表を確認します')
    .addSubcommand((subcommand) =>
      subcommand.setName('trial_balance').setDescription('試算表を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('entries')
        .setDescription('仕訳一覧を表示します')
        .addStringOption((option) =>
          option.setName('from').setDescription('開始日 YYYY-MM-DD').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('to').setDescription('終了日 YYYY-MM-DD').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add_entry')
        .setDescription('仕訳を追加します')
        .addStringOption((option) =>
          option.setName('date').setDescription('日付 YYYY-MM-DD').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('debit').setDescription('借方勘定科目').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('credit').setDescription('貸方勘定科目').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('amount').setDescription('金額').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('description').setDescription('摘要').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'yayoi_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'trial_balance') {
        const items = await getTrialBalance(token);
        const embed = new EmbedBuilder().setTitle('弥生会計 試算表').setColor(0x0078d4);

        if (items.length === 0) {
          embed.setDescription('試算表データは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              items.slice(0, 10).map(
                (item) =>
                  `**${item.account_name}**\nDebit: ${item.debit_amount}\nCredit: ${item.credit_amount}\nBalance: ${item.balance}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'entries') {
        const from = interaction.options.getString('from')?.trim();
        const to = interaction.options.getString('to')?.trim();
        const entries = await getJournalEntries(token, from, to);
        const embed = new EmbedBuilder().setTitle('弥生会計 仕訳一覧').setColor(0x0078d4);

        if (from) {
          embed.addFields({ name: 'From', value: from, inline: true });
        }

        if (to) {
          embed.addFields({ name: 'To', value: to, inline: true });
        }

        if (entries.length === 0) {
          embed.setDescription('仕訳は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              entries.slice(0, 10).map(
                (entry) =>
                  `**${entry.date || '-'}**\nID: ${entry.id}\n${entry.debit_account} -> ${entry.credit_account}\nAmount: ${entry.amount}\n${truncate(entry.description || '-', 200)}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const date = interaction.options.getString('date', true).trim();
      const debit = interaction.options.getString('debit', true).trim();
      const credit = interaction.options.getString('credit', true).trim();
      const amount = interaction.options.getInteger('amount', true);
      const description = interaction.options.getString('description')?.trim() ?? '';
      const entry = await createJournalEntry(token, date, debit, credit, amount, description);
      const embed = new EmbedBuilder()
        .setTitle('弥生会計 仕訳を追加しました')
        .setColor(0x0078d4)
        .addFields(
          { name: 'ID', value: entry.id || '-', inline: true },
          { name: 'Date', value: date, inline: true },
          { name: 'Amount', value: String(amount), inline: true },
          { name: 'Debit', value: truncate(debit, 1024), inline: true },
          { name: 'Credit', value: truncate(credit, 1024), inline: true },
          { name: 'Description', value: truncate(description || '-', 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, '弥生会計連携の処理中にエラーが発生しました。');

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
