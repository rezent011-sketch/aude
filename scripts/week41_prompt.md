=== Week41: エルメ・Utage・Lメッセージ Webhook連携 ===

既存のLステップWebhook実装（src/integrations/lstep.ts / src/commands/lstep.ts）を参考に、
以下の3ツールのWebhook連携を実装してください。

---
=== TASK 1: エルメ Webhook連携 ===

【src/integrations/elme.ts を新規作成】

型定義:
type ElmeWebhookEvent = {
  event: string;
  userId: string;
  displayName?: string;
  message?: string;
  tagName?: string;
  scenarioName?: string;
  timestamp: number;
}

以下を実装:

export function parseElmeWebhook(body: unknown): ElmeWebhookEvent
  バリデーション: event と userId が文字列でなければ import { IntegrationError } from './errors' をthrow

export function formatElmeEventMessage(event: ElmeWebhookEvent): string
  イベント種別ごとに日本語Discord通知文:
  - follow: '👤 [エルメ] 新規フォロー: {displayName} ({userId})'
  - unfollow: '👋 [エルメ] フォロー解除: {displayName} ({userId})'
  - message: '💬 [エルメ] メッセージ受信: {displayName} → {message}'
  - tag_added: '🏷️ [エルメ] タグ追加: {displayName} に [{tagName}] が付与されました'
  - scenario_started: '▶️ [エルメ] シナリオ開始: {displayName} が [{scenarioName}] を開始しました'
  - scenario_completed: '✅ [エルメ] シナリオ完了: {displayName} が [{scenarioName}] を完了しました'
  - その他: '📌 [エルメ] イベント [{event}]: {userId}'

export async function forwardElmeToDiscord(
  discordClient: import('discord.js').Client,
  channelId: string,
  event: ElmeWebhookEvent
): Promise<void>
  formatElmeEventMessage でメッセージ生成し discord チャンネルに送信。
  チャンネルがテキストチャンネルでない場合は IntegrationError をthrow。

【src/commands/elme.ts を新規作成】

SlashCommandBuilder コマンド名: 'elme'
description: 'エルメWebhookの設定とLINEイベント受信を行います'

サブコマンド:
  setup: Webhook URLと設定手順をEmbedで表示 (color: 0x06C755)
    「エルメ管理画面 → 設定 → 外部Webhook → {BASE_URL}/webhook/elme を設定」
  channel: 通知先チャンネル設定 options: channel_id(string, required)
    vaultService で 'elme_discord_channel_id' として setCredential で保存

import vaultService from '../services/vaultService'
import { getErrorMessage } from '../integrations/errors'

---
=== TASK 2: Utage Webhook連携 ===

【src/integrations/utage.ts を新規作成】

型定義:
type UtageWebhookEvent = {
  event: string;
  userId: string;
  displayName?: string;
  email?: string;
  phone?: string;
  stepName?: string;
  amount?: number;
  timestamp: number;
}

以下を実装:

export function parseUtageWebhook(body: unknown): UtageWebhookEvent
  バリデーション: event と userId が文字列でなければ IntegrationError をthrow

export function formatUtageEventMessage(event: UtageWebhookEvent): string
  イベント種別ごとに日本語Discord通知文:
  - line_follow: '👤 [Utage] LINE新規登録: {displayName} ({userId})'
  - line_unfollow: '👋 [Utage] LINEブロック: {displayName} ({userId})'
  - email_registered: '📧 [Utage] メール登録: {displayName} ({email})'
  - step_completed: '✅ [Utage] ステップ完了: {displayName} が [{stepName}] を完了'
  - purchase: '💰 [Utage] 購入完了: {displayName} ¥{amount}'
  - その他: '📌 [Utage] イベント [{event}]: {userId}'

export async function forwardUtageToDiscord(
  discordClient: import('discord.js').Client,
  channelId: string,
  event: UtageWebhookEvent
): Promise<void>
  チャンネルに通知を送信。

【src/commands/utage.ts を新規作成】

SlashCommandBuilder コマンド名: 'utage'
description: 'Utage Webhookの設定とマーケティングイベント受信を行います'

サブコマンド:
  setup: Webhook URLと設定手順をEmbedで表示 (color: 0xFF6B35)
    「Utage管理画面 → 設定 → Webhook → {BASE_URL}/webhook/utage を設定」
  channel: 通知先チャンネル設定 options: channel_id(string, required)
    vaultService で 'utage_discord_channel_id' として保存

---
=== TASK 3: Lメッセージ Webhook連携 ===

【src/integrations/lmessage.ts を新規作成】

型定義:
type LmessageWebhookEvent = {
  event: string;
  userId: string;
  displayName?: string;
  message?: string;
  buttonLabel?: string;
  richMenuName?: string;
  timestamp: number;
}

以下を実装:

export function parseLmessageWebhook(body: unknown): LmessageWebhookEvent
  バリデーション: event と userId が文字列でなければ IntegrationError をthrow

export function formatLmessageEventMessage(event: LmessageWebhookEvent): string
  イベント種別ごとに日本語Discord通知文:
  - follow: '👤 [Lメッセージ] 新規フォロー: {displayName} ({userId})'
  - unfollow: '👋 [Lメッセージ] ブロック: {displayName} ({userId})'
  - message: '💬 [Lメッセージ] メッセージ: {displayName} → {message}'
  - button_click: '🔘 [Lメッセージ] ボタンタップ: {displayName} が [{buttonLabel}] をタップ'
  - richmenu_tap: '📋 [Lメッセージ] リッチメニュータップ: {displayName} → {richMenuName}'
  - その他: '📌 [Lメッセージ] イベント [{event}]: {userId}'

export async function forwardLmessageToDiscord(
  discordClient: import('discord.js').Client,
  channelId: string,
  event: LmessageWebhookEvent
): Promise<void>
  チャンネルに通知を送信。

【src/commands/lmessage.ts を新規作成】

SlashCommandBuilder コマンド名: 'lmessage'
description: 'LメッセージWebhookの設定とLINEイベント受信を行います'

サブコマンド:
  setup: Webhook URLと設定手順をEmbedで表示 (color: 0x00B900)
    「Lメッセージ管理画面 → 設定 → 外部Webhook → {BASE_URL}/webhook/lmessage を設定」
  channel: 通知先チャンネル設定 options: channel_id(string, required)
    vaultService で 'lmessage_discord_channel_id' として保存

---
=== TASK 4: server.ts に3つのWebhookエンドポイントを追加 ===

src/server.ts を編集。
既存の「Lステップ Webhook受信」ブロック（POST /webhook/lstep）の直後に以下を追加:

// エルメ Webhook受信
if (method === 'POST' && url.pathname === '/webhook/elme') {
  -- lstep と同じパターンで実装
  -- parseElmeWebhook, forwardElmeToDiscord を使用
  -- channelId は process.env.ELME_DISCORD_CHANNEL_ID
  -- 常に res.status(200).json({ ok: true }) を返す
}

// Utage Webhook受信  
if (method === 'POST' && url.pathname === '/webhook/utage') {
  -- parseUtageWebhook, forwardUtageToDiscord を使用
  -- channelId は process.env.UTAGE_DISCORD_CHANNEL_ID
}

// Lメッセージ Webhook受信
if (method === 'POST' && url.pathname === '/webhook/lmessage') {
  -- parseLmessageWebhook, forwardLmessageToDiscord を使用
  -- channelId は process.env.LMESSAGE_DISCORD_CHANNEL_ID
}

server.ts の先頭importに追加:
import { parseElmeWebhook, forwardElmeToDiscord } from './integrations/elme';
import { parseUtageWebhook, forwardUtageToDiscord } from './integrations/utage';
import { parseLmessageWebhook, forwardLmessageToDiscord } from './integrations/lmessage';

---
=== TASK 5: commandHandler.ts への登録 ===

src/handlers/commandHandler.ts を編集:
1. import追加:
   import { elmeCommand } from '../commands/elme';
   import { utageCommand } from '../commands/utage';
   import { lmessageCommand } from '../commands/lmessage';
2. commands配列に elmeCommand, utageCommand, lmessageCommand を追加

---
注意: npm installは不要。TypeScript型エラーなし。git commitは不要（wrapper scriptが行う）。
既存ファイル（server.ts, commandHandler.ts）は追記のみ、既存コードを壊さないこと。
