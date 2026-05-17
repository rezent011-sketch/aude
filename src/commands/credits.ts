import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { creditsManager } from '../credits/manager';

function formatUsageHistory(
  transactions: ReturnType<typeof creditsManager.getRecentUsageHistory>
): string {
  if (transactions.length === 0) {
    return '直近の利用履歴はありません。';
  }

  return transactions
    .map((transaction) => {
      const timestamp = new Date(transaction.createdAt).toLocaleString('ja-JP', {
        hour12: false,
      });

      return `- ${timestamp} | -${transaction.amount} | ${transaction.description ?? '利用'}`;
    })
    .join('\n');
}

export const creditsCommand = {
  data: new SlashCommandBuilder()
    .setName('credits')
    .setDescription('残クレジットと直近の使用履歴を表示します'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const username = interaction.user.username;
    const remainingCredits = creditsManager.getRemainingCredits(discordId, username);
    const recentUsage = creditsManager.getRecentUsageHistory(discordId, username, 5);

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('クレジット残高')
      .setDescription(`残クレジット: **${remainingCredits}**`)
      .addFields({
        name: '直近5件の使用履歴',
        value: formatUsageHistory(recentUsage),
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
