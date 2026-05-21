=== Week58: CircleCI・Brevo・Copper・SurveyMonkey連携（4ツール・最終100コマンド達成） ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: CircleCI連携 ===

【src/integrations/circleci.ts を新規作成】

CircleCI API v2 を使用。
認証: Circle-Token ヘッダー
Base URL: https://circleci.com/api/v2

export async function getPipelines(token: string, orgSlug: string): Promise<Array<{ id: string; number: number; state: string; created_at: string; trigger_parameters?: Record<string, unknown>; }>>
  GET https://circleci.com/api/v2/project/{orgSlug}/pipeline?per-page=10
  ヘッダー: { 'Circle-Token': token }
  レスポンス: { items: [{ id, number, state, created_at }] }

export async function getWorkflows(token: string, pipelineId: string): Promise<Array<{ id: string; name: string; status: string; created_at: string; stopped_at: string | null; }>>
  GET https://circleci.com/api/v2/pipeline/{pipelineId}/workflow
  レスポンス: { items: [{ id, name, status, created_at, stopped_at }] }

export async function triggerPipeline(token: string, orgSlug: string, branch?: string): Promise<{ id: string; number: number; state: string; }>
  POST https://circleci.com/api/v2/project/{orgSlug}/pipeline
  body: { branch: branch || 'main' }
  レスポンス: { id, number, state }

全関数: import { IntegrationError } from './errors'

【src/commands/circleci.ts を新規作成】
コマンド名: 'circleci'
description: 'CircleCIのパイプライン・ワークフローを管理します'
サブコマンド: pipelines(org_slug string required, description: 'GitHub組織/リポジトリ例: gh/org/repo') / workflows(pipeline_id string required) / trigger(org_slug string required, branch string optional)
vaultService から 'circleci_api_token' 取得。未設定ガイド color: 0x343434

---
=== TASK 2: Brevo（旧Sendinblue）メール連携 ===

【src/integrations/brevo.ts を新規作成】

Brevo API v3 を使用。
認証: api-key ヘッダー
Base URL: https://api.brevo.com/v3

export async function getContacts(apiKey: string, limit?: number): Promise<Array<{ id: number; email: string; firstName: string; lastName: string; }>>
  GET https://api.brevo.com/v3/contacts?limit={limit||20}
  ヘッダー: { 'api-key': apiKey }
  レスポンス: { contacts: [{ id, email, attributes: { FIRSTNAME, LASTNAME } }] }
  -> { id, email, firstName: attributes.FIRSTNAME||'', lastName: attributes.LASTNAME||'' }

export async function sendTransactionalEmail(apiKey: string, to: string, subject: string, htmlContent: string, senderEmail: string, senderName?: string): Promise<{ messageId: string; }>
  POST https://api.brevo.com/v3/smtp/email
  body: { sender: { name: senderName||'Aude', email: senderEmail }, to: [{ email: to }], subject, htmlContent }
  レスポンス: { messageId }

export async function getEmailStats(apiKey: string): Promise<{ requests: number; delivered: number; hardBounces: number; softBounces: number; opens: number; clicks: number; }>
  GET https://api.brevo.com/v3/smtp/statistics/aggregatedReport
  レスポンス: { requests, delivered, hardBounces, softBounces, opens, clicks }

全関数: import { IntegrationError } from './errors'

【src/commands/brevo.ts を新規作成】
コマンド名: 'brevo'
description: 'Brevoのコンタクト・メール配信を管理します'
サブコマンド: contacts(limit integer optional) / send(to/subject/content string required, sender string optional) / stats
vaultService から 'brevo_api_key', 'brevo_sender_email' 取得。未設定ガイド color: 0x0B996E

---
=== TASK 3: Copper CRM連携 ===

【src/integrations/copper.ts を新規作成】

Copper CRM API v1 を使用。
認証: X-PW-AccessToken + X-PW-Application + X-PW-UserEmail ヘッダー
Base URL: https://api.copper.com/developer_api/v1

export async function searchPeople(token: string, email: string, userEmail: string): Promise<Array<{ id: number; name: string; email: string; company_name: string; }>>
  POST https://api.copper.com/developer_api/v1/people/search
  ヘッダー: { 'X-PW-AccessToken': token, 'X-PW-Application': 'developer_api', 'X-PW-UserEmail': userEmail, 'Content-Type': 'application/json' }
  body: { page_size: 20 }
  レスポンス: [{ id, name, emails: [{ email }], company_name }]
  -> { id, name, email: emails[0]?.email||'', company_name }

export async function getOpportunities(token: string, userEmail: string): Promise<Array<{ id: number; name: string; status: string; monetary_value: number; close_date: string; }>>
  POST https://api.copper.com/developer_api/v1/opportunities/search
  body: { page_size: 20 }
  レスポンス: [{ id, name, status, monetary_value, close_date }]

export async function createPerson(token: string, userEmail: string, name: string, email: string): Promise<{ id: number; name: string; }>
  POST https://api.copper.com/developer_api/v1/people
  body: { name, emails: [{ email, category: 'work' }] }
  レスポンス: { id, name }

全関数: import { IntegrationError } from './errors'

【src/commands/copper.ts を新規作成】
コマンド名: 'copper'
description: 'Copper CRMの連絡先・商談を管理します'
サブコマンド: people(検索、query string optional) / opportunities / add(name/email string required)
vaultService から 'copper_api_token', 'copper_user_email' 取得。未設定ガイド color: 0xEA8B04

---
=== TASK 4: SurveyMonkey連携 ===

【src/integrations/surveymonkey.ts を新規作成】

SurveyMonkey API v3 を使用。
認証: Bearer token
Base URL: https://api.surveymonkey.com/v3

export async function getSurveys(token: string): Promise<Array<{ id: string; title: string; response_count: number; date_created: string; }>>
  GET https://api.surveymonkey.com/v3/surveys?per_page=20
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { data: [{ id, title, response_count, date_created }] }

export async function getSurveyDetails(token: string, surveyId: string): Promise<{ id: string; title: string; question_count: number; response_count: number; }>
  GET https://api.surveymonkey.com/v3/surveys/{surveyId}/details
  レスポンス: { id, title, question_count, response_count }

export async function getResponses(token: string, surveyId: string): Promise<Array<{ id: string; date_created: string; total_time: number; }>>
  GET https://api.surveymonkey.com/v3/surveys/{surveyId}/responses/bulk?per_page=10
  レスポンス: { data: [{ id, date_created, total_time }] }

全関数: import { IntegrationError } from './errors'

【src/commands/surveymonkey.ts を新規作成】
コマンド名: 'surveymonkey'
description: 'SurveyMonkeyのアンケート・回答を確認します'
サブコマンド: surveys / details(survey_id string required) / responses(survey_id string required)
vaultService から 'surveymonkey_access_token' 取得。未設定ガイド color: 0x00BF6F

---
=== TASK 5: commandHandler.ts への登録 ===
import { circleciCommand } from '../commands/circleci';
import { brevoCommand } from '../commands/brevo';
import { copperCommand } from '../commands/copper';
import { surveymonkeyCommand } from '../commands/surveymonkey';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
これで100コマンド達成！
