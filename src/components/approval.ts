import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { ApprovalRecord } from '../db/approvalRepository';

export const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000;

const APPROVAL_CUSTOM_ID_PREFIX = 'approval';
const DISPLAY_TIME_ZONE = process.env.SCHEDULE_TIMEZONE ?? 'Asia/Tokyo';

export type ApprovalAction = 'approve' | 'reject';

function formatApprovalDate(value: string): string {
  return new Date(value).toLocaleString('ja-JP', {
    hour12: false,
    timeZone: DISPLAY_TIME_ZONE,
  });
}

function getApprovalPolicyLabel(record: ApprovalRecord): string {
  return record.requesterPlan === 'team'
    ? 'Team プラン: サーバー内の全員が承認可能'
    : 'Free/Starter/Pro: 管理者のみ承認可能';
}

function buildApprovalCustomId(action: ApprovalAction, approvalId: number): string {
  return `${APPROVAL_CUSTOM_ID_PREFIX}:${action}:${approvalId}`;
}

export function parseApprovalCustomId(
  customId: string
): { action: ApprovalAction; approvalId: number } | null {
  const [prefix, action, approvalIdText] = customId.split(':');

  if (
    prefix !== APPROVAL_CUSTOM_ID_PREFIX ||
    (action !== 'approve' && action !== 'reject') ||
    !approvalIdText
  ) {
    return null;
  }

  const approvalId = Number(approvalIdText);
  if (!Number.isInteger(approvalId) || approvalId <= 0) {
    return null;
  }

  return { action, approvalId };
}

export function buildApprovalButtons(
  approvalId: number,
  disabled = false
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildApprovalCustomId('approve', approvalId))
      .setLabel('✅承認')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(buildApprovalCustomId('reject', approvalId))
      .setLabel('❌拒否')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
}

export function buildPendingApprovalEmbed(record: ApprovalRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`承認待ちタスク #${record.id}`)
    .setDescription(record.taskDescription)
    .addFields(
      { name: '依頼者', value: `<@${record.requesterDiscordId}>`, inline: true },
      { name: 'モデル', value: record.model, inline: true },
      { name: '承認ルール', value: getApprovalPolicyLabel(record), inline: false },
      { name: 'タイムアウト', value: formatApprovalDate(record.expiresAt), inline: false }
    )
    .setFooter({ text: 'ボタンで承認または拒否してください。10分で自動キャンセルされます。' })
    .setTimestamp(new Date(record.createdAt));
}

export function buildRunningApprovalEmbed(record: ApprovalRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`実行中タスク #${record.id}`)
    .setDescription(record.taskDescription)
    .addFields(
      { name: '依頼者', value: `<@${record.requesterDiscordId}>`, inline: true },
      {
        name: '承認者',
        value: record.approverDiscordId ? `<@${record.approverDiscordId}>` : '不明',
        inline: true,
      },
      { name: 'モデル', value: record.model, inline: true }
    )
    .setFooter({ text: '承認済みです。タスクを実行しています。' })
    .setTimestamp(new Date(record.startedAt ?? record.createdAt));
}

export function buildRejectedApprovalEmbed(record: ApprovalRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`拒否されたタスク #${record.id}`)
    .setDescription(record.taskDescription)
    .addFields(
      { name: '依頼者', value: `<@${record.requesterDiscordId}>`, inline: true },
      {
        name: '対応者',
        value: record.approverDiscordId ? `<@${record.approverDiscordId}>` : '不明',
        inline: true,
      }
    )
    .setFooter({ text: 'このタスクは実行されませんでした。' })
    .setTimestamp(new Date(record.decidedAt ?? record.createdAt));
}

export function buildTimedOutApprovalEmbed(record: ApprovalRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x95a5a6)
    .setTitle(`タイムアウトしたタスク #${record.id}`)
    .setDescription(record.taskDescription)
    .addFields(
      { name: '依頼者', value: `<@${record.requesterDiscordId}>`, inline: true },
      { name: '失効時刻', value: formatApprovalDate(record.expiresAt), inline: true }
    )
    .setFooter({ text: '10分以内に承認されなかったため自動キャンセルされました。' })
    .setTimestamp(new Date(record.expiresAt));
}

export function buildCompletedApprovalEmbed(record: ApprovalRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`完了タスク #${record.id}`)
    .setDescription(record.taskDescription)
    .addFields(
      { name: '依頼者', value: `<@${record.requesterDiscordId}>`, inline: true },
      {
        name: '承認者',
        value: record.approverDiscordId ? `<@${record.approverDiscordId}>` : '不明',
        inline: true,
      }
    )
    .setFooter({ text: '承認されたタスクの実行が完了しました。' })
    .setTimestamp(new Date(record.completedAt ?? record.startedAt ?? record.createdAt));
}

export function buildFailedApprovalEmbed(record: ApprovalRecord): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`失敗したタスク #${record.id}`)
    .setDescription(record.taskDescription)
    .addFields(
      { name: '依頼者', value: `<@${record.requesterDiscordId}>`, inline: true },
      {
        name: '承認者',
        value: record.approverDiscordId ? `<@${record.approverDiscordId}>` : '不明',
        inline: true,
      },
      { name: 'エラー', value: record.errorMessage ?? '不明なエラー', inline: false }
    )
    .setFooter({ text: 'タスク実行中にエラーが発生しました。' })
    .setTimestamp(new Date(record.completedAt ?? record.startedAt ?? record.createdAt));
}
