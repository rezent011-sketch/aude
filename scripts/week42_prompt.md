=== Week42: Money Forward・Slack・Sansan連携 ===

既存のパターン（src/integrations/chatwork.ts / src/commands/chatwork.ts）を参考に、
以下の3ツールの連携を実装してください。

---
=== TASK 1: Money Forward クラウド会計連携 ===

【src/integrations/moneyforward.ts を新規作成】

Money Forward クラウドAPI (https://invoice.moneyforward.com/api/v3) を使用。
認証: Bearer token (MONEYFORWARD_ACCESS_TOKEN)。

以下の関数を実装:

export async function getOffices(token: string): Promise<Array<{ id: string; name: string;}>>
  GET https://invoice.moneyforward.com/api/v3/offices
  レスポンス: { data: { office: { id, name } }[] } -> idとnameの配列を返す

export async function getInvoices(token: string, officeId: string): Promise<Array<{ id: string; title: string; status: string; amount: number; }>>
  GET https://invoice.moneyforward.com/api/v3/offices/{officeId}/billings
  レスポンス: { data: { billing: { id, title, payment_status, total_price_including_tax } }[] }
  -> id, title, status(payment_status), amount(total_price_including_tax) の配列を返す

export async function getExpenses(token: string, officeId: string): Promise<Array<{ id: string; subject: string; amount: number; status: string; }>>
  GET https://invoice.moneyforward.com/api/v3/offices/{officeId}/expense_applications
  レスポンス: { data: { expense_application: { id, title, office_member_name, amount, status } }[] }
  -> id, subject(title), amount, status の配列を返す

全関数:
- import { IntegrationError } from './errors' を使ったエラーハンドリング
- fetch使用。Authorization: Bearer {token} ヘッダー必須
- HTTPエラー時はIntegrationErrorをthrow

【src/commands/moneyforward.ts を新規作成】

SlashCommandBuilder コマンド名: 'moneyforward'
description: 'Money Forwardの請求書・経費申請を参照します'

サブコマンド:
  offices: 事業所一覧を表示
  invoices: 請求書一覧
    options: office_id(string, required)
  expenses: 経費申請一覧
    options: office_id(string, required)

vaultService から 'moneyforward_access_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: 'Money Forward アクセストークンが未設定です'
  説明: '/vault set key:moneyforward_access_token value:<token> を実行してください'
  color: 0x003087

EmbedBuilderで結果整形。既存 chatwork.ts と同じ構造を踏襲。

---
=== TASK 2: Slack連携 ===

【src/integrations/slack.ts を新規作成】

Slack Web API (https://api.slack.com/methods) を使用。
認証: Bot Token (xoxb-...) Bearer認証。
Base URL: https://slack.com/api

以下の関数を実装:

export async function getChannels(token: string): Promise<Array<{ id: string; name: string; is_private: boolean; }>>
  POST https://slack.com/api/conversations.list
  body: { types: 'public_channel,private_channel', limit: 100 }
  レスポンス: { channels: [{ id, name, is_private }] } -> 配列を返す

export async function sendMessage(token: string, channel: string, text: string): Promise<void>
  POST https://slack.com/api/chat.postMessage
  body: { channel, text }
  レスポンス: { ok: boolean, error?: string }
  ok=falseの場合はIntegrationError(error)をthrow

export async function getMessages(token: string, channel: string): Promise<Array<{ user: string; text: string; ts: string; }>>
  POST https://slack.com/api/conversations.history
  body: { channel, limit: 10 }
  レスポンス: { messages: [{ user, text, ts }] } -> 配列を返す

export async function getUserInfo(token: string, userId: string): Promise<{ name: string; real_name: string; email: string; }>
  POST https://slack.com/api/users.info
  body: { user: userId }
  レスポンス: { user: { name, real_name, profile: { email } } }
  -> { name, real_name, email: profile.email } を返す

全関数:
- import { IntegrationError } from './errors'
- Content-Type: application/json; charset=utf-8
- Authorization: Bearer {token}

【src/commands/slack.ts を新規作成】

SlashCommandBuilder コマンド名: 'slack'
description: 'Slackのチャンネル・メッセージを操作します'

サブコマンド:
  channels: チャンネル一覧表示
  send: メッセージ送信
    options: channel(string, required, description: 'チャンネルIDまたは名前'), message(string, required)
  messages: 最近のメッセージ一覧
    options: channel(string, required)
  user: ユーザー情報取得
    options: user_id(string, required)

vaultService から 'slack_bot_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: 'Slack Bot Tokenが未設定です'
  説明: '/vault set key:slack_bot_token value:xoxb-... を実行してください'
  color: 0x4A154B

EmbedBuilderで結果整形。

---
=== TASK 3: Sansan連携 ===

【src/integrations/sansan.ts を新規作成】

Sansan API (https://docs.ap.sansan.com/ja/) を使用。
認証: X-Sansan-Token ヘッダー。
Base URL: https://api.sansan.com/v2

以下の関数を実装:

export async function getContacts(token: string, keyword?: string): Promise<Array<{ id: string; name: string; company: string; email: string; }>>
  GET https://api.sansan.com/v2/bizCards
  params: keyword があれば ?keyword={keyword}
  レスポンス: { data: [{ bizCardId, name: { lastName, firstName }, company: { name }, email }] }
  -> { id: bizCardId, name: `${lastName} ${firstName}`, company: company.name, email } の配列を返す

export async function getContact(token: string, id: string): Promise<{ id: string; name: string; company: string; title: string; email: string; tel: string; }>
  GET https://api.sansan.com/v2/bizCards/{id}
  レスポンス: { data: { bizCardId, name: { lastName, firstName }, company: { name }, title, email, tel } }

全関数:
- import { IntegrationError } from './errors'
- ヘッダー: { 'X-Sansan-Token': token, 'Accept': 'application/json' }

【src/commands/sansan.ts を新規作成】

SlashCommandBuilder コマンド名: 'sansan'
description: 'Sansanの名刺・連絡先を検索・参照します'

サブコマンド:
  search: 名刺検索
    options: keyword(string, optional, description: '検索キーワード（名前・会社名等）')
  contact: 名刺詳細
    options: id(string, required)

vaultService から 'sansan_api_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: 'Sansan APIトークンが未設定です'
  説明: '/vault set key:sansan_api_token value:<token> を実行してください'
  color: 0xFF6600

EmbedBuilderで結果整形。

---
=== TASK 4: commandHandler.ts への登録 ===

src/handlers/commandHandler.ts を編集:
1. import追加:
   import { moneyforwardCommand } from '../commands/moneyforward';
   import { slackCommand } from '../commands/slack';
   import { sansanCommand } from '../commands/sansan';
2. commands配列に上記3つを追加

---
注意事項:
- npm installは不要（fetch標準）
- TypeScript型エラーなし（strict mode）
- git commitは不要（wrapper scriptが行う）
- 既存ファイルを壊さないこと
- コードにバッククォートや${}テンプレートリテラルを使う際は通常通りTypeScriptとして書いてよい
