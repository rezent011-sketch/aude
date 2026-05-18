// src/services/analyticsService.ts
// 使用統計・レポート集計サービス

import db from '../db/index';

export interface DailyStats {
  date: string;
  messages: number;
  unique_users: number;
  claude_calls: number;
  gpt4o_calls: number;
  credits_consumed: number;
  new_users: number;
}

export interface ModelUsageStats {
  model: string;
  total_calls: number;
  total_credits: number;
  percentage: number;
}

export interface TopUser {
  discord_id: string;
  username: string;
  message_count: number;
  credits_consumed: number;
  subscription_plan: string | null;
}

export interface AnalyticsSummary {
  period_days: number;
  total_messages: number;
  total_unique_users: number;
  total_credits_consumed: number;
  avg_messages_per_day: number;
  avg_messages_per_user: number;
  most_active_day: string | null;
  growth_rate: number; // % change in users vs previous period
}

export function getDailyStats(days: number = 7): DailyStats[] {
  const stmt = db.prepare(`
    SELECT
      DATE(c.createdAt) AS date,
      COUNT(*) AS messages,
      COUNT(DISTINCT c.userId) AS unique_users,
      0 AS claude_calls,
      0 AS gpt4o_calls,
      COALESCE(SUM(t.amount), 0) AS credits_consumed,
      0 AS new_users
    FROM conversations c
    LEFT JOIN transactions t ON t.userId = c.userId
      AND DATE(t.createdAt) = DATE(c.createdAt)
      AND t.type = 'use'
    WHERE c.createdAt >= DATE('now', ?)
      AND c.role = 'user'
    GROUP BY DATE(c.createdAt)
    ORDER BY date ASC
  `);
  return stmt.all(`-${days} days`) as DailyStats[];
}

export function getModelUsageStats(days: number = 30): ModelUsageStats[] {
  // creditsの消費からモデル使用量を推定
  // (将来的にconversationsテーブルにmodelカラムを追加すれば正確に集計できる)
  const total = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE type = 'use' AND createdAt >= DATE('now', ?)
  `).get(`-${days} days`) as { total: number };

  const totalVal = total?.total ?? 0;

  // 暫定: 60% Claude / 40% GPT-4o と仮定（modelカラム追加後に正確化）
  return [
    {
      model: 'Claude',
      total_calls: Math.round(totalVal * 0.006),
      total_credits: Math.round(totalVal * 0.6),
      percentage: 60,
    },
    {
      model: 'GPT-4o',
      total_calls: Math.round(totalVal * 0.004),
      total_credits: Math.round(totalVal * 0.4),
      percentage: 40,
    },
  ];
}

export function getTopUsers(days: number = 30, limit: number = 10): TopUser[] {
  const stmt = db.prepare(`
    SELECT
      u.discordId AS discord_id,
      u.username,
      COUNT(c.id) AS message_count,
      COALESCE(SUM(CASE WHEN t.type = 'use' THEN t.amount ELSE 0 END), 0) AS credits_consumed,
      s.plan AS subscription_plan
    FROM users u
    LEFT JOIN conversations c ON c.userId = u.id
      AND c.createdAt >= DATE('now', ?)
      AND c.role = 'user'
    LEFT JOIN transactions t ON t.userId = u.id
      AND t.createdAt >= DATE('now', ?)
    LEFT JOIN subscriptions s ON s.userId = u.id
    GROUP BY u.id, u.discordId, u.username, s.plan
    HAVING message_count > 0
    ORDER BY message_count DESC
    LIMIT ?
  `);
  return stmt.all(`-${days} days`, `-${days} days`, limit) as TopUser[];
}

export function getAnalyticsSummary(days: number = 30): AnalyticsSummary {
  const current = db.prepare(`
    SELECT
      COUNT(*) AS total_messages,
      COUNT(DISTINCT userId) AS total_unique_users,
      COALESCE(SUM(t.amount), 0) AS total_credits_consumed
    FROM conversations c
    LEFT JOIN transactions t ON t.userId = c.userId
      AND t.createdAt >= DATE('now', ?)
      AND t.type = 'use'
    WHERE c.createdAt >= DATE('now', ?)
      AND c.role = 'user'
  `).get(`-${days} days`, `-${days} days`) as {
    total_messages: number;
    total_unique_users: number;
    total_credits_consumed: number;
  };

  const previous = db.prepare(`
    SELECT COUNT(DISTINCT userId) AS total_unique_users
    FROM conversations
    WHERE createdAt >= DATE('now', ?)
      AND createdAt < DATE('now', ?)
      AND role = 'user'
  `).get(`-${days * 2} days`, `-${days} days`) as { total_unique_users: number };

  const mostActiveDay = db.prepare(`
    SELECT DATE(createdAt) AS date, COUNT(*) AS cnt
    FROM conversations
    WHERE createdAt >= DATE('now', ?)
      AND role = 'user'
    GROUP BY DATE(createdAt)
    ORDER BY cnt DESC
    LIMIT 1
  `).get(`-${days} days`) as { date: string; cnt: number } | undefined;

  const prevUsers = previous?.total_unique_users ?? 0;
  const currUsers = current?.total_unique_users ?? 0;
  const growthRate = prevUsers > 0
    ? Math.round(((currUsers - prevUsers) / prevUsers) * 100)
    : (currUsers > 0 ? 100 : 0);

  return {
    period_days: days,
    total_messages: current?.total_messages ?? 0,
    total_unique_users: currUsers,
    total_credits_consumed: current?.total_credits_consumed ?? 0,
    avg_messages_per_day: Math.round((current?.total_messages ?? 0) / days),
    avg_messages_per_user: currUsers > 0
      ? Math.round((current?.total_messages ?? 0) / currUsers)
      : 0,
    most_active_day: mostActiveDay?.date ?? null,
    growth_rate: growthRate,
  };
}
