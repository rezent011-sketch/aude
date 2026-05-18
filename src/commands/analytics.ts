import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import {
  getAnalyticsSummary,
  getDailyStats,
  getTopUsers,
} from '../services/analyticsService';

export const analyticsCommand = {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('Aude の使用状況と統計を表示します')
    .addSubcommand((sub) =>
      sub
        .setName('summary')
        .setDescription('指定期間の概要を表示します')
        .addIntegerOption((opt) =>
          opt
            .setName('days')
            .setDescription('集計期間 (日数、デフォルト: 30)')
            .setMinValue(1)
            .setMaxValue(90)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('daily')
        .setDescription('直近の日別統計を表示します')
        .addIntegerOption((opt) =>
          opt
            .setName('days')
            .setDescription('表示日数 (デフォルト: 7)')
            .setMinValue(1)
            .setMaxValue(30)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('top_users')
        .setDescription('アクティブユーザーランキングを表示します')
        .addIntegerOption((opt) =>
          opt
            .setName('days')
            .setDescription('集計期間 (日数、デフォルト: 30)')
            .setMinValue(1)
            .setMaxValue(90)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'summary') {
        const days = interaction.options.getInteger('days') ?? 30;
        const s = getAnalyticsSummary(days);
        const growthSign = s.growth_rate >= 0 ? '+' : '';

        await interaction.editReply([
          `📊 **Analytics — 直近 ${days} 日間**`,
          '',
          `総メッセージ数: **${s.total_messages.toLocaleString('ja-JP')}**`,
          `ユニークユーザー: **${s.total_unique_users.toLocaleString('ja-JP')}**`,
          `消費クレジット: **${s.total_credits_consumed.toLocaleString('ja-JP')}**`,
          `1日平均メッセージ: **${s.avg_messages_per_day}**`,
          `ユーザー平均メッセージ: **${s.avg_messages_per_user}**`,
          `最もアクティブな日: **${s.most_active_day ?? '-'}**`,
          `ユーザー成長率 (前同期比): **${growthSign}${s.growth_rate}%**`,
        ].join('\n'));
        return;
      }

      if (subcommand === 'daily') {
        const days = interaction.options.getInteger('days') ?? 7;
        const stats = getDailyStats(days);

        if (!stats.length) {
          await interaction.editReply(`📊 直近 ${days} 日間のデータがまだありません。`);
          return;
        }

        const lines = stats.map((d) =>
          `\`${d.date}\`  💬 ${d.messages}  👤 ${d.unique_users}  💳 -${d.credits_consumed}cr`
        );

        await interaction.editReply([
          `📊 **日別統計 — 直近 ${days} 日**`,
          '```',
          'Date         Msgs  Users  Credits',
          ...stats.map((d) =>
            `${d.date}  ${String(d.messages).padStart(4)}  ${String(d.unique_users).padStart(5)}  ${String(d.credits_consumed).padStart(7)}`
          ),
          '```',
        ].join('\n').slice(0, 1900));
        return;
      }

      if (subcommand === 'top_users') {
        const days = interaction.options.getInteger('days') ?? 30;
        const users = getTopUsers(days, 10);

        if (!users.length) {
          await interaction.editReply(`📊 直近 ${days} 日間のアクティブユーザーがいません。`);
          return;
        }

        const lines = users.map((u, i) =>
          `${i + 1}. **${u.username}** — ${u.message_count} msgs / ${u.credits_consumed} cr` +
          (u.subscription_plan ? ` (${u.subscription_plan})` : '')
        );

        await interaction.editReply([
          `🏆 **アクティブユーザー TOP ${users.length} — 直近 ${days} 日**`,
          '',
          ...lines,
        ].join('\n').slice(0, 1900));
        return;
      }

      await interaction.editReply('⚠️ 不明なサブコマンドです。');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await interaction.editReply(`⚠️ エラーが発生しました: ${msg}`);
    }
  },
};
