import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { creditsManager } from '../credits/manager';
import SubscriptionRepository from '../db/subscriptionRepository';
import { getPlanLabelJa } from '../stripe/plans';

function translateStatus(status: string): string {
  const labels: Record<string, string> = {
    active: '有効',
    trialing: 'お試し期間中',
    past_due: '支払い遅延',
    canceled: '解約済み',
    unpaid: '未払い',
    incomplete: '処理中',
    incomplete_expired: '期限切れ',
  };

  return labels[status] ?? status;
}

function formatExpiryDate(value: string | null): string {
  if (!value) {
    return 'なし';
  }

  return new Date(value).toLocaleString('ja-JP', {
    hour12: false,
  });
}

export const planCommand = {
  data: new SlashCommandBuilder()
    .setName('plan')
    .setDescription('現在のプラン、有効期限、残クレジットを表示します'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const username = interaction.user.username;
    const subscription = SubscriptionRepository.getByDiscordId(discordId);
    const remainingCredits = creditsManager.getRemainingCredits(discordId, username);
    const plan = subscription?.plan ?? 'free';
    const status = subscription?.status ?? 'active';

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle('現在のプラン')
      .addFields(
        {
          name: 'プラン',
          value: getPlanLabelJa(plan),
          inline: true,
        },
        {
          name: 'ステータス',
          value: translateStatus(status),
          inline: true,
        },
        {
          name: '有効期限',
          value: formatExpiryDate(subscription?.currentPeriodEnd ?? null),
          inline: false,
        },
        {
          name: '残クレジット',
          value: remainingCredits.toLocaleString('ja-JP'),
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
