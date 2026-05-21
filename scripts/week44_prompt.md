=== Week44: クラウドサイン・KING OF TIME・弥生会計連携 ===

既存のパターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に、
以下の3つの日本特化ツール連携を実装してください。

---
=== TASK 1: クラウドサイン（電子契約）連携 ===

【src/integrations/cloudsign.ts を新規作成】

クラウドサイン API (https://developer.cloudsign.jp/v2.0) を使用。
認証: Bearer token
Base URL: https://app.cloudsign.jp/api

以下の関数を実装:

export async function getDocuments(token: string): Promise<Array<{ id: string; title: string; status: string; created_at: string; }>>
  GET https://app.cloudsign.jp/api/documents
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { documents: [{ id, title, status, created_at }] }
  -> 配列を返す

export async function getDocument(token: string, id: string): Promise<{ id: string; title: string; status: string; participants: Array<{ email: string; status: string; }>; }>
  GET https://app.cloudsign.jp/api/documents/{id}
  レスポンス: { document: { id, title, status, participants: [{ email, status }] } }

export async function createDocument(token: string, title: string): Promise<{ id: string; title: string; }>
  POST https://app.cloudsign.jp/api/documents
  body: { document: { title } }
  レスポンス: { document: { id, title } }

全関数:
- import { IntegrationError } from './errors'
- Content-Type: application/json
- HTTPエラー時はIntegrationErrorをthrow

【src/commands/cloudsign.ts を新規作成】

SlashCommandBuilder コマンド名: 'cloudsign'
description: 'クラウドサインの電子契約書を管理します'

サブコマンド:
  documents: 契約書一覧
  document: 契約書詳細
    options: id(string, required)
  create: 契約書作成
    options: title(string, required)

vaultService から 'cloudsign_api_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: 'クラウドサイン APIトークンが未設定です'
  説明: '/vault set key:cloudsign_api_token value:<token> を実行してください'
  color: 0x0066CC

EmbedBuilderで結果整形。

---
=== TASK 2: KING OF TIME 勤怠連携 ===

【src/integrations/kingoftimeコt.ts を新規作成（ファイル名: src/integrations/kingofthyme.ts）】
※ファイル名は kingofthyme.ts（ typo ではなくコマンド名の都合）

KING OF TIME API (https://developer.kingofthyme.jp/) を使用。
認証: Bearerトークン
Base URL: https://api.kingofthyme.jp/v1

以下の関数を実装:

export async function getEmployees(token: string): Promise<Array<{ employee_id: string; name: string; group_name: string; }>>
  GET https://api.kingofthyme.jp/v1/employees
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { employees: [{ employee_id, name, group_name }] }
  -> 配列を返す

export async function getDailyAttendance(token: string, date: string): Promise<Array<{ employee_id: string; name: string; clock_in: string; clock_out: string; work_time: string; }>>
  GET https://api.kingofthyme.jp/v1/daily_attendances?date={date}
  レスポンス: { daily_attendances: [{ employee_id, employee_name, start_time, end_time, work_time }] }
  -> { employee_id, name: employee_name, clock_in: start_time, clock_out: end_time, work_time } の配列

export async function getMonthlyAttendance(token: string, employeeId: string, year: number, month: number): Promise<Array<{ date: string; work_time: string; }>>
  GET https://api.kingofthyme.jp/v1/monthly_attendances?employee_id={employeeId}&year={year}&month={month}
  レスポンス: { monthly_attendances: [{ date, work_time }] }
  -> 配列を返す

全関数:
- import { IntegrationError } from './errors'
- HTTPエラー時はIntegrationErrorをthrow

【src/commands/kingofthyme.ts を新規作成】

SlashCommandBuilder コマンド名: 'kingofthyme'
description: 'KING OF TIMEで勤怠データを確認します'

サブコマンド:
  employees: 従業員一覧
  daily: 日次勤怠一覧
    options: date(string, optional, description: '日付 YYYY-MM-DD、省略時は今日')
  monthly: 月次勤怠
    options: employee_id(string, required), year(integer, optional), month(integer, optional)

vaultService から 'kingofthyme_api_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: 'KING OF TIME APIトークンが未設定です'
  説明: '/vault set key:kingofthyme_api_token value:<token> を実行してください'
  color: 0xE60012

EmbedBuilderで結果整形。

---
=== TASK 3: 弥生会計オンライン連携 ===

【src/integrations/yayoi.ts を新規作成】

弥生会計オンライン API (https://developer.yayoi-kk.co.jp/) を使用。
認証: Bearer token (OAuth2)
Base URL: https://api.yayoi-kk.co.jp/v1

以下の関数を実装:

export async function getTrialBalance(token: string): Promise<Array<{ account_name: string; debit_amount: number; credit_amount: number; balance: number; }>>
  GET https://api.yayoi-kk.co.jp/v1/trial_balance
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { items: [{ account_name, debit_amount, credit_amount, balance }] }
  -> 配列を返す

export async function getJournalEntries(token: string, from?: string, to?: string): Promise<Array<{ id: string; date: string; debit_account: string; credit_account: string; amount: number; description: string; }>>
  GET https://api.yayoi-kk.co.jp/v1/journal_entries?from={from}&to={to}
  レスポンス: { journal_entries: [{ id, date, debit_account, credit_account, amount, description }] }
  -> 配列を返す

export async function createJournalEntry(token: string, date: string, debitAccount: string, creditAccount: string, amount: number, description: string): Promise<{ id: string }>
  POST https://api.yayoi-kk.co.jp/v1/journal_entries
  body: { date, debit_account: debitAccount, credit_account: creditAccount, amount, description }
  レスポンス: { journal_entry: { id } }

全関数:
- import { IntegrationError } from './errors'
- HTTPエラー時はIntegrationErrorをthrow

【src/commands/yayoi.ts を新規作成】

SlashCommandBuilder コマンド名: 'yayoi'
description: '弥生会計の仕訳・試算表を確認します'

サブコマンド:
  trial_balance: 試算表を表示
  entries: 仕訳一覧
    options: from(string, optional, description: '開始日 YYYY-MM-DD'), to(string, optional, description: '終了日 YYYY-MM-DD')
  add_entry: 仕訳追加
    options: date(string, required), debit(string, required, description: '借方勘定科目'), credit(string, required, description: '貸方勘定科目'), amount(integer, required), description(string, optional)

vaultService から 'yayoi_access_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: '弥生会計 アクセストークンが未設定です'
  説明: '/vault set key:yayoi_access_token value:<token> を実行してください'
  color: 0x0078D4

EmbedBuilderで結果整形。

---
=== TASK 4: commandHandler.ts への登録 ===

src/handlers/commandHandler.ts を編集:
1. import追加:
   import { cloudsignCommand } from '../commands/cloudsign';
   import { kingofthymeCommand } from '../commands/kingofthyme';
   import { yayoiCommand } from '../commands/yayoi';
2. commands配列に上記3つを追加

---
注意事項:
- npm installは不要（fetch標準）
- TypeScript型エラーなし（strict mode）
- git commitは不要（wrapper scriptが行う）
- 既存ファイルを壊さないこと（commandHandler.tsは追記のみ）
