=== Week43: Jobcan・Cybozu Office・Talentio連携 ===

既存のパターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に、
以下の3つの日本特化ツール連携を実装してください。

---
=== TASK 1: Jobcan 勤怠管理連携 ===

【src/integrations/jobcan.ts を新規作成】

Jobcan API (https://developer.jobcan.jp/jobcan/reference) を使用。
認証: クエリパラメータ token=<api_token>
Base URL: https://ssl.jobcan.jp/api

以下の関数を実装:

export async function getStaffList(token: string): Promise<Array<{ id: number; name: string; group_name: string; }>>
  GET https://ssl.jobcan.jp/api/staff?token={token}
  レスポンス: { result: number; staffs: [{ staff_id, name, group_name }] }
  result !== 1 の場合はIntegrationError
  -> { id: staff_id, name, group_name } の配列を返す

export async function getAttendance(token: string, staffId: number, year: number, month: number): Promise<Array<{ date: string; work_time: string; early_over_time: string; }>>
  GET https://ssl.jobcan.jp/api/attendance?token={token}&staff_id={staffId}&year={year}&month={month}
  レスポンス: { result: number; attendances: [{ date, work_time, early_over_time }] }
  -> 配列を返す

export async function clockIn(token: string, note?: string): Promise<void>
  POST https://ssl.jobcan.jp/api/adit
  body URLencoded: token={token}&adit_type=work_start&note={note}
  Content-Type: application/x-www-form-urlencoded
  レスポンス: { result: number } result !== 1 でIntegrationError

export async function clockOut(token: string, note?: string): Promise<void>
  POST https://ssl.jobcan.jp/api/adit
  body URLencoded: token={token}&adit_type=work_end&note={note}
  result !== 1 でIntegrationError

全関数:
- import { IntegrationError } from './errors'
- fetch使用

【src/commands/jobcan.ts を新規作成】

SlashCommandBuilder コマンド名: 'jobcan'
description: 'Jobcanで出退勤打刻・勤怠データを管理します'

サブコマンド:
  clockin: 出勤打刻
    options: note(string, optional, description: '備考')
  clockout: 退勤打刻
    options: note(string, optional)
  staff: スタッフ一覧表示
  attendance: 勤怠データ確認
    options: staff_id(integer, required), year(integer, optional, default: 現在年), month(integer, optional, default: 現在月)

vaultService から 'jobcan_api_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: 'Jobcan APIトークンが未設定です'
  説明: '/vault set key:jobcan_api_token value:<token> を実行してください'
  color: 0x00A0E9

EmbedBuilderで結果整形。

---
=== TASK 2: Cybozu Office連携 ===

【src/integrations/cybozu.ts を新規作成】

Cybozu Office API を使用。
認証: X-Cybozu-Authorization ヘッダー（Base64エンコードの "login:password"）
Base URL: https://{subdomain}.cybozu.com/g/api/v1

以下の関数を実装:

export async function getSchedules(login: string, password: string, subdomain: string, date: string): Promise<Array<{ id: string; subject: string; start: string; end: string; members: string[]; }>>
  GET https://{subdomain}.cybozu.com/g/api/v1/schedule/events?rangeStart={date}&rangeEnd={date}
  ヘッダー: { 'X-Cybozu-Authorization': Buffer.from(login+':'+password).toString('base64'), 'Content-Type': 'application/json' }
  レスポンス: { events: [{ id, subject, start: { dateTime }, end: { dateTime }, attendees: [{ name }] }] }
  -> { id, subject, start: start.dateTime, end: end.dateTime, members: attendees.map(a => a.name) } の配列

export async function createSchedule(login: string, password: string, subdomain: string, subject: string, start: string, end: string): Promise<{ id: string }>
  POST https://{subdomain}.cybozu.com/g/api/v1/schedule/events
  body: { subject, start: { dateTime: start }, end: { dateTime: end } }
  レスポンス: { id }

export async function getBulletinBoards(login: string, password: string, subdomain: string): Promise<Array<{ id: string; name: string; }>>
  GET https://{subdomain}.cybozu.com/g/api/v1/bulletin/categories
  レスポンス: { bulletinBoardCategories: [{ id, name }] }

全関数:
- import { IntegrationError } from './errors'
- HTTPエラー時はIntegrationErrorをthrow

【src/commands/cybozu.ts を新規作成】

SlashCommandBuilder コマンド名: 'cybozu'
description: 'Cybozu Officeのスケジュール・掲示板を操作します'

サブコマンド:
  schedule: 指定日のスケジュール一覧
    options: date(string, optional, description: '日付 YYYY-MM-DD形式、省略時は今日')
  create_schedule: スケジュール作成
    options: subject(string, required), start(string, required, description: 'YYYY-MM-DDTHH:MM'), end(string, required)
  boards: 掲示板カテゴリ一覧

vaultService から 'cybozu_login', 'cybozu_password', 'cybozu_subdomain' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: 'Cybozu Office認証情報が未設定です'
  説明: 'cybozu_login, cybozu_password, cybozu_subdomain を /vault set で設定してください'
  color: 0xD71920

---
=== TASK 3: Talentio 採用管理連携 ===

【src/integrations/talentio.ts を新規作成】

Talentio API (https://developer.talentio.com/) を使用。
認証: Bearer token (TALENTIO_ACCESS_TOKEN)
Base URL: https://talentio.com/api/v1

以下の関数を実装:

export async function getJobs(token: string): Promise<Array<{ id: number; name: string; status: string; }>>
  GET https://talentio.com/api/v1/jobs
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { jobs: [{ id, name, status }] }
  -> 配列を返す

export async function getCandidates(token: string, jobId?: number): Promise<Array<{ id: number; name: string; status: string; applied_at: string; }>>
  GET https://talentio.com/api/v1/candidates
  params: jobId があれば ?job_id={jobId}
  レスポンス: { candidates: [{ id, name, current_progress_name, applied_at }] }
  -> { id, name, status: current_progress_name, applied_at } の配列

export async function getCandidate(token: string, id: number): Promise<{ id: number; name: string; email: string; status: string; job_name: string; }>
  GET https://talentio.com/api/v1/candidates/{id}
  レスポンス: { candidate: { id, name, email, current_progress_name, job: { name } } }
  -> { id, name, email, status: current_progress_name, job_name: job.name }

全関数:
- import { IntegrationError } from './errors'
- HTTPエラー時はIntegrationErrorをthrow

【src/commands/talentio.ts を新規作成】

SlashCommandBuilder コマンド名: 'talentio'
description: 'Talentioで求人・候補者を管理します'

サブコマンド:
  jobs: 求人一覧表示
  candidates: 候補者一覧
    options: job_id(integer, optional, description: '求人IDでフィルタ')
  candidate: 候補者詳細
    options: id(integer, required)

vaultService から 'talentio_access_token' を取得。
未設定時はEmbedBuilderで設定ガイドを返す:
  タイトル: 'Talentio アクセストークンが未設定です'
  説明: '/vault set key:talentio_access_token value:<token> を実行してください'
  color: 0x4CAF50

EmbedBuilderで結果整形。

---
=== TASK 4: commandHandler.ts への登録 ===

src/handlers/commandHandler.ts を編集:
1. import追加:
   import { jobcanCommand } from '../commands/jobcan';
   import { cybozuCommand } from '../commands/cybozu';
   import { talentioCommand } from '../commands/talentio';
2. commands配列に上記3つを追加

---
注意事項:
- npm installは不要（fetch標準、BufferはNode.js標準）
- TypeScript型エラーなし（strict mode）
- git commitは不要（wrapper scriptが行う）
- 既存ファイルを壊さないこと（commandHandler.tsは追記のみ）
