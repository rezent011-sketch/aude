=== Week40: LINE Messaging API連携 + Lステップ Webhook連携 ===

既存パターン（chatwork.ts / kintone.ts）を参考に実装してください。

---
=== TASK 1: LINE Messaging API 連携 ===

【src/integrations/line.ts を新規作成】

LINE Messaging API を使用。
認証: Channel Access Token (Bearer)。
Base URL: https://api.line.me/v2/bot

以下の関数をすべて実装:

export async function pushMessage(token: string, to: string, text: string): Promise<void>
  POST https://api.line.me/v2/bot/message/push
  body: { to, messages: [{ type: 'text', text }] }

export async function broadcastMessage(token: string, text: string): Promise<void>
  POST https://api.line.me/v2/bot/message/broadcast
  body: { messages: [{ type: 'text', text }] }

export async function getProfile(token: string, userId: string): Promise<{ displayName: string; pictureUrl: string; statusMessage: string }>
  GET https://api.line.me/v2/bot/profile/{userId}

export async function getFollowerIds(token: string): Promise<string[]>
  GET https://api.line.me/v2/bot/followers/ids
  レスポンス: { userIds: string[] } -> userIds を返す

export async function replyMessage(token: string, replyToken: string, text: string): Promise<void>
  POST https://api.line.me/v2/bot/message/reply
  body: { replyToken, messages: [{ type: 'text', text }] }

export async function getBotInfo(token: string): Promise<{ displayName: string; pictureUrl: string; chatMode: string }>
  GET https://api.line.me/v2/bot/info

全関数でエラーハンドリング: import { IntegrationError } from './errors'
fetch使用。Authorization: Bearer {token} ヘッダー必須。
HTTPエラー時は response.json() でエラーメッセージを取得してIntegrationErrorをthrow。

【src/commands/line.ts を新規作成】

SlashCommandBuilder コマンド名: 'line'
description: 'LINE公式アカウントのメッセージ送信・フォロワー管理を行います'

サブコマンド:
  push: user_id(string, required), message(string, required)
  broadcast: message(string, required)
  profile: user_id(string, required)
  followers: フォロワーID一覧
  botinfo: Bot情報確認

vaultService から 'line_channel_access_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す（color: 0x06C755）。
既存 chatwork.ts と同じ構造を踏襲。

---
=== TASK 2: Lステップ Webhook連携 ===

Lステップは外部公開APIなし。Webhookベースで連携する。

【src/integrations/lstep.ts を新規作成】

型定義:
type LstepWebhookEvent = {
  event: string;
  userId: string;
  displayName?: string;
  message?: string;
  tagName?: string;
  timestamp: number;
}

以下を実装:

export function parseLstepWebhook(body: unknown): LstepWebhookEvent
  バリデーション: event と userId が文字列でなければ IntegrationError をthrow

export function formatLstepEventMessage(event: LstepWebhookEvent): string
  イベント種別ごとに日本語Discord通知文を生成:
  - follow: '👤 新規フォロー: {displayName} ({userId})'
  - message: '💬 メッセージ受信: {displayName} → {message}'
  - tag_added: '🏷️ タグ追加: {displayName} に [{tagName}] が付与されました'
  - scenario_completed: '✅ シナリオ完了: {displayName} がシナリオを完了しました'
  - その他: '📌 Lステップイベント [{event}]: {userId}'

export async function forwardToDiscord(
  discordClient: import('discord.js').Client,
  channelId: string,
  event: LstepWebhookEvent
): Promise<void>
  formatLstepEventMessage でメッセージ生成し、discordClient.channels.fetch(channelId) でチャンネル取得してsendする。
  チャンネルがTextChannelでない場合はIntegrationErrorをthrow。

【src/server.ts の編集】

既存の src/server.ts に POST /webhook/lstep エンドポイントを追加:
  - parseLstepWebhook(req.body) でイベント解析
  - LSTEP_DISCORD_CHANNEL_ID が設定されていれば forwardToDiscord を呼ぶ
  - 常に res.status(200).json({ ok: true }) を返す
  - エラー時はconsole.errorのみ（Webhookは常に200返却）
  discordClient のインポートは既存の src/services/discordClient.ts から取得すること。

【src/commands/lstep.ts を新規作成】

SlashCommandBuilder コマンド名: 'lstep'
description: 'LステップWebhookの設定と受信イベント確認を行います'

サブコマンド:
  setup: Webhook URLと設定手順をEmbedで表示（color: 0x00B900）
    「Lステップ管理画面 → 外部連携 → Webhook URLに {BASE_URL}/webhook/lstep を設定」
  channel: 通知先Discordチャンネル設定 options: channel_id(string, required)
    vaultService で 'lstep_discord_channel_id' として保存

---
=== TASK 3: commandHandler.ts への登録 ===

src/handlers/commandHandler.ts を編集:
1. import { lineCommand } from '../commands/line';
2. import { lstepCommand } from '../commands/lstep';
3. commands配列に lineCommand と lstepCommand を追加

---
注意: npm installは不要。TypeScript型エラーなし。git commitは不要（wrapper scriptが行う）。
既存ファイルを壊さないこと（server.tsは追記のみ）。
