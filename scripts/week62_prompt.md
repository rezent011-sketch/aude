=== Week62: Notion強化・Coda・Linear強化・Retool・Zapier・Make・n8n連携（100ツール達成！） ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。
このWeekで外部ツール連携が100個になります！

---
=== TASK 1: Coda連携 ===

【src/integrations/coda.ts を新規作成】

Coda API v1 を使用。認証: Bearer token
Base URL: https://coda.io/apis/v1

export async function listDocs(token: string): Promise<Array<{ id: string; name: string; owner: string; createdAt: string; }>>
  GET https://coda.io/apis/v1/docs?limit=20
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { items: [{ id, name, owner, createdAt }] }

export async function listTables(token: string, docId: string): Promise<Array<{ id: string; name: string; rowCount: number; }>>
  GET https://coda.io/apis/v1/docs/{docId}/tables?limit=20
  レスポンス: { items: [{ id, name, rowCount }] }

export async function listRows(token: string, docId: string, tableId: string): Promise<Array<{ id: string; name: string; values: Record<string, unknown>; }>>
  GET https://coda.io/apis/v1/docs/{docId}/tables/{tableId}/rows?limit=20
  レスポンス: { items: [{ id, name, values }] }

全関数: import { IntegrationError } from './errors'

【src/commands/coda.ts を新規作成】
コマンド名: 'coda', description: 'CodaのドキュメントとテーブルをDiscordから操作します'
サブコマンド: docs / tables(doc_id string required) / rows(doc_id/table_id string required)
vaultService から 'coda_api_token' 取得。未設定ガイド color: 0xE73025

---
=== TASK 2: Retool連携 ===

【src/integrations/retool.ts を新規作成】

Retool API を使用。認証: Bearer token (Access Token)
Base URL: https://api.retool.com/v1

export async function getApps(token: string): Promise<Array<{ id: string; name: string; pageUuid: string; createdAt: string; updatedAt: string; }>>
  GET https://api.retool.com/v1/apps
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { success: boolean; data: [{ id, name, pageUuid, createdAt, updatedAt }] }

export async function getUsers(token: string): Promise<Array<{ id: string; email: string; firstName: string; lastName: string; role: string; }>>
  GET https://api.retool.com/v1/users
  レスポンス: { success: boolean; data: [{ id, email, firstName, lastName, memberRole }] }
  -> { id, email, firstName, lastName, role: memberRole }

全関数: import { IntegrationError } from './errors'

【src/commands/retool.ts を新規作成】
コマンド名: 'retool', description: 'Retoolのアプリ・ユーザーを管理します'
サブコマンド: apps / users
vaultService から 'retool_access_token' 取得。未設定ガイド color: 0x3D63DD

---
=== TASK 3: Zapier Webhook連携 ===

【src/integrations/zapier.ts を新規作成】

ZapierはWebhookベースの連携。ZapierのWebhook URLにPOSTしてザップをトリガーする。

export async function triggerZap(webhookUrl: string, data: Record<string, unknown>): Promise<{ status: string; }>
  POST {webhookUrl}
  ヘッダー: Content-Type: application/json
  body: { ...data, _source: 'aude_discord', _timestamp: new Date().toISOString() }
  レスポンス: { status: 'success' } または任意JSONを返す
  200系なら { status: 'triggered' }を返す、それ以外はIntegrationError

export async function testWebhook(webhookUrl: string): Promise<boolean>
  triggerZap(webhookUrl, { test: true, message: 'Aude test connection' }) を呼ぶ
  成功したらtrueを返す

全関数: import { IntegrationError } from './errors'

【src/commands/zapier.ts を新規作成】
コマンド名: 'zapier', description: 'ZapierのWebhookをトリガーして自動化を実行します'
サブコマンド:
  trigger: Zapierザップをトリガー
    options: webhook_url(string, required), data(string, optional, description: 'JSON形式の追加データ')
    dataをJSON.parseしてtriggerZapに渡す。パース失敗時は空オブジェクト使用。
  test: Webhook接続テスト
    options: webhook_url(string, required)
vaultService から 'zapier_webhook_url' を取得（デフォルトURL用）。
直接URLを指定した場合はvaultのURLより優先。
未設定でも webhook_url オプションがあれば動作可能。color: 0xFF4A00

---
=== TASK 4: Make（旧Integromat）Webhook連携 ===

【src/integrations/make.ts を新規作成】

Make（Integromat）はWebhookベースの連携。

export async function triggerScenario(webhookUrl: string, data: Record<string, unknown>): Promise<{ accepted: boolean; }>
  POST {webhookUrl}
  ヘッダー: Content-Type: application/json
  body: { ...data, _source: 'aude_discord', _timestamp: new Date().toISOString() }
  200系なら { accepted: true }、それ以外はIntegrationError

export async function getScenarios(apiKey: string, teamId: string): Promise<Array<{ id: number; name: string; isActive: boolean; lastEdit: string; }>>
  GET https://eu1.make.com/api/v2/scenarios?teamId={teamId}
  ヘッダー: Authorization: Token {apiKey}
  レスポンス: { scenarios: [{ id, name, isActive, lastEdit }] }

全関数: import { IntegrationError } from './errors'

【src/commands/make.ts を新規作成】
コマンド名: 'make', description: 'Make（旧Integromat）のシナリオをトリガーします'
サブコマンド:
  trigger: options: webhook_url(string, required), data(string, optional)
  scenarios: options: team_id(string, required)
vaultService から 'make_api_key' 取得。未設定ガイド color: 0x6D00CC

---
=== TASK 5: n8n Webhook連携 ===

【src/integrations/n8n.ts を新規作成】

n8nはセルフホスト/クラウドのワークフロー自動化。Webhookベースの連携。

export async function triggerWorkflow(webhookUrl: string, data: Record<string, unknown>): Promise<unknown>
  POST {webhookUrl}
  ヘッダー: Content-Type: application/json
  body: { ...data, _source: 'aude_discord', _timestamp: new Date().toISOString() }
  レスポンスをそのまま返す。HTTPエラー時はIntegrationError。

export async function getWorkflows(baseUrl: string, apiKey: string): Promise<Array<{ id: string; name: string; active: boolean; createdAt: string; }>>
  GET {baseUrl}/api/v1/workflows
  ヘッダー: X-N8N-API-KEY: {apiKey}
  レスポンス: { data: [{ id, name, active, createdAt }] }

全関数: import { IntegrationError } from './errors'

【src/commands/n8n.ts を新規作成】
コマンド名: 'n8n', description: 'n8nのワークフローをトリガーします'
サブコマンド:
  trigger: options: webhook_url(string, required), data(string, optional)
  workflows: options: base_url(string, optional, description: 'n8nのベースURL、省略時はvaultから取得')
vaultService から 'n8n_api_key', 'n8n_base_url' 取得。未設定ガイド color: 0xEA4B71

---
=== TASK 6: commandHandler.ts への登録（Week59〜62 全18ツール） ===

src/handlers/commandHandler.ts を編集して以下をすべてimportしてcommands配列に追加:

Week59分:
import { miroCommand } from '../commands/miro';
import { loomCommand } from '../commands/loom';
import { webflowCommand } from '../commands/webflow';
import { stripebillingCommand } from '../commands/stripebilling';

Week60分:
import { amplitudeCommand } from '../commands/amplitude';
import { mixpanelCommand } from '../commands/mixpanel';
import { segmentCommand } from '../commands/segment';
import { postmarkCommand } from '../commands/postmark';
import { vonageCommand } from '../commands/vonage';

Week61分:
import { sentryCommand } from '../commands/sentry';
import { cloudflareCommand } from '../commands/cloudflare';
import { herokuCommand } from '../commands/heroku';
import { launchdarklyCommand } from '../commands/launchdarkly';
import { statuspageCommand } from '../commands/statuspage';

Week62分:
import { codaCommand } from '../commands/coda';
import { retoolCommand } from '../commands/retool';
import { zapierCommand } from '../commands/zapier';
import { makeCommand } from '../commands/make';
import { n8nCommand } from '../commands/n8n';

以上すべてをcommands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
これで外部ツール連携が100個達成！
