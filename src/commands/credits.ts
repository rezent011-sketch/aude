import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { creditsService } from '../services/creditsService';

function formatTransactions(
  transactions: ReturnType<typeof creditsService.getTransactionHistory>,
): string {
  if (transactions.length === 0) {
    return '取引履歴はありません。';
  }

  return transactions
    .slice(0, 10)
    .map((transaction) => {
      const signedAmount = transaction.type === 'credit' ? `+${transaction.amount}` : `-${transaction.amount}`;
      const timestamp = new Date(transaction.created_at).toLocaleString('ja-JP', {
        hour12: false,
      });
      return `${timestamp} | ${signedAmount} | ${transaction.description ?? '-'}`;
    })
    .join('\n');
}

export const creditsCommand = {
  data: new SlashCommandBuilder()
    .setName('credits')
    .setDescription('クレジット残高、履歴、購入リンクを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('balance').setDescription('現在の残高を表示します'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('history').setDescription('取引履歴を表示します'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('buy')
        .setDescription('Stripe Checkoutでクレジットを購入します')
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('購入するクレジット数')
            .setRequired(true)
            .setMinValue(1),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const username = interaction.user.username;

    if (subcommand === 'balance') {
      const balance = creditsService.getBalance(userId, username);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x1f8b4c)
            .setTitle('クレジット残高')
            .setDescription(`現在の残高は **${balance}** クレジットです。`)
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'history') {
      const transactions = creditsService.getTransactionHistory(userId, username);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('クレジット取引履歴')
            .setDescription(formatTransactions(transactions))
            .setTimestamp(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'buy') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const amount = interaction.options.getInteger('amount', true);
      const session = await creditsService.createCheckoutSession({
        userId,
        username,
        amount,
      });

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x635bff)
            .setTitle('Stripe Checkout')
            .setDescription(
              `以下のURLから ${amount} クレジットを購入してください。\n${session.url ?? '-'}`,
            )
            .addFields(
              { name: '購入クレジット', value: String(amount), inline: true },
              { name: '決済金額', value: `¥${amount.toLocaleString('ja-JP')}`, inline: true },
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    await interaction.reply({
      content: '不正なサブコマンドです。',
      flags: MessageFlags.Ephemeral,
    });
  },
};
