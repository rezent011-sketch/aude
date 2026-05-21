=== Week46: Rakumo・freeeサイン・GMO電子印鑑連携 ===

既存のパターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Rakumo（Google Workspace連携カレンダー）連携 ===

【src/integrations/rakumo.ts を新規作成】

Rakumo API (https://rakumo.com/service/) を使用。
認証: Bearer token（rakumo_api_token）
Base URL: https://a.rakumo.com/api/v2

以下の関数を実装:

export async function getCalendarEvents(token: string, start: string, end: string): Promise<Array<{ id: string; title: string; start: string; end: string; organizer: string; }>>
  GET https://a.rakumo.com/api/v2/calendar/events?start={start}&end={end}
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { events: [{ id, summary, start: { dateTime }, end: { dateTime }, organizer: { displayName } }] }
  -> { id, title: summary, start: start.dateTime, end: end.dateTime, organizer: organizer.displayName } の配列

export async function createCalendarEvent(token: string, title: string, start: string, end: string, attendees?: string[]): Promise<{ id: string; title: string; }>
  POST https://a.rakumo.com/api/v2/calendar/events
  body: { summary: title, start: { dateTime: start }, end: { dateTime: end }, attendees: (attendees || []).map(email => ({ email })) }
  レスポンス: { event: { id, summary } }
  -> { id, title: summary }

export async function getContacts(token: string, keyword?: string): Promise<Array<{ id: string; name: string; email: string; company: string; }>>
  GET https://a.rakumo.com/api/v2/contacts?keyword={keyword}
  レスポンス: { contacts: [{ id, displayName, email, organization }] }
  -> { id, name: displayName, email, company: organization } の配列

全関数: import { IntegrationError } from './errors'

【src/commands/rakumo.ts を新規作成】

SlashCommandBuilder コマンド名: 'rakumo'
description: 'Rakumoのカレンダー・コンタクトを操作します'

サブコマンド:
  events: カレンダーイベント一覧
    options: start(string, optional, description: '開始日 YYYY-MM-DD'), end(string, optional)
  create_event: イベント作成
    options: title(string, required), start(string, required, description: 'YYYY-MM-DDTHH:MM'), end(string, required), attendees(string, optional, description: 'メールアドレスをカンマ区切りで')
  contacts: コンタクト検索
    options: keyword(string, optional)

vaultService から 'rakumo_api_token' を取得。
未設定時ガイド: color 0x0066FF

---
=== TASK 2: freeeサイン（電子契約）連携 ===

【src/integrations/freeesign.ts を新規作成】

freeeサイン API を使用。
認証: Bearer token
Base URL: https://api.freeesign.jp/v2

以下の関数を実装:

export async function getContracts(token: string): Promise<Array<{ id: string; title: string; status: string; created_at: string; }>>
  GET https://api.freeesign.jp/v2/contracts
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { contracts: [{ id, title, status, created_at }] }
  -> 配列を返す

export async function getContract(token: string, id: string): Promise<{ id: string; title: string; status: string; signers: Array<{ email: string; status: string; signed_at: string | null; }>; }>
  GET https://api.freeesign.jp/v2/contracts/{id}
  レスポンス: { contract: { id, title, status, signers: [{ email, status, signed_at }] } }

export async function createContract(token: string, title: string, signerEmails: string[]): Promise<{ id: string; title: string; }>
  POST https://api.freeesign.jp/v2/contracts
  body: { title, signers: signerEmails.map(email => ({ email })) }
  レスポンス: { contract: { id, title } }

全関数: import { IntegrationError } from './errors'

【src/commands/freeesign.ts を新規作成】

SlashCommandBuilder コマンド名: 'freeesign'
description: 'freeeサインの電子契約書を管理します'

サブコマンド:
  contracts: 契約書一覧
  contract: 契約書詳細
    options: id(string, required)
  create: 契約書作成
    options: title(string, required), signers(string, required, description: '署名者メールアドレスをカンマ区切りで')

vaultService から 'freeesign_api_token' を取得。
未設定時ガイド: color 0x00C4A7

---
=== TASK 3: GMO電子印鑑 Agree連携 ===

【src/integrations/gmoagree.ts を新規作成】

GMO電子印鑑 Agree API を使用。
認証: APIキー（X-Agree-Api-Key ヘッダー）
Base URL: https://contractapi.agreepage.jp/api/v1

以下の関数を実装:

export async function getDocuments(apiKey: string): Promise<Array<{ document_id: string; document_name: string; status: string; created_at: string; }>>
  GET https://contractapi.agreepage.jp/api/v1/documents
  ヘッダー: { 'X-Agree-Api-Key': apiKey }
  レスポンス: { documents: [{ document_id, document_name, status, created_at }] }
  -> 配列を返す

export async function getDocument(apiKey: string, documentId: string): Promise<{ document_id: string; document_name: string; status: string; signers: Array<{ name: string; email: string; status: string; }> }>
  GET https://contractapi.agreepage.jp/api/v1/documents/{documentId}
  レスポンス: { document: { document_id, document_name, status, signers: [{ name, email, status }] } }

export async function sendReminder(apiKey: string, documentId: string): Promise<void>
  POST https://contractapi.agreepage.jp/api/v1/documents/{documentId}/remind
  レスポンス: { result: 'ok' } でなければIntegrationError

全関数: import { IntegrationError } from './errors'

【src/commands/gmoagree.ts を新規作成】

SlashCommandBuilder コマンド名: 'gmoagree'
description: 'GMO電子印鑑 Agreeの契約書を管理します'

サブコマンド:
  documents: 書類一覧
  document: 書類詳細
    options: id(string, required)
  remind: 署名リマインド送信
    options: id(string, required)

vaultService から 'gmoagree_api_key' を取得。
未設定時ガイド: color 0x0040A0

---
=== TASK 4: commandHandler.ts への登録 ===

src/handlers/commandHandler.ts を編集:
1. import追加: rakumoCommand, freeesignCommand, gmoagreeCommand
2. commands配列に追加

---
注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
