=== Week63: 外部ツール連携100個達成のための残り6ツール ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Figmaファイル管理（figmaコマンドとは別） ===

【src/integrations/figmafiles.ts を新規作成】

Figma REST API を使用。認証: X-Figma-Token ヘッダー

export async function getTeamProjects(token: string, teamId: string): Promise<Array<{ id: string; name: string; }>>
  GET https://api.figma.com/v1/teams/{teamId}/projects
  ヘッダー: { 'X-Figma-Token': token }
  レスポンス: { projects: [{ id, name }] }

export async function getProjectFiles(token: string, projectId: string): Promise<Array<{ key: string; name: string; last_modified: string; }>>
  GET https://api.figma.com/v1/projects/{projectId}/files
  レスポンス: { files: [{ key, name, last_modified }] }

export async function getFileComments(token: string, fileKey: string): Promise<Array<{ id: string; message: string; user: string; created_at: string; }>>
  GET https://api.figma.com/v1/files/{fileKey}/comments
  レスポンス: { comments: [{ id, message, user: { handle }, created_at }] }
  -> { id, message, user: user.handle, created_at }

全関数: import { IntegrationError } from './errors'

【src/commands/figmafiles.ts を新規作成】
コマンド名: 'figmafiles', description: 'Figmaのプロジェクト・ファイル・コメントを管理します'
サブコマンド: projects(team_id string required) / files(project_id string required) / comments(file_key string required)
vaultService から 'figma_access_token' 取得。未設定ガイド color: 0xF24E1E

---
=== TASK 2: HubSpot CRM強化 ===

【src/integrations/hubspotcrm.ts を新規作成】

HubSpot CRM API v3 を使用。認証: Bearer token

export async function getContacts(token: string, limit?: number): Promise<Array<{ id: string; email: string; firstName: string; lastName: string; company: string; }>>
  GET https://api.hubapi.com/crm/v3/objects/contacts?limit={limit||20}&properties=email,firstname,lastname,company
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { results: [{ id, properties: { email, firstname, lastname, company } }] }
  -> { id, email: p.email||'', firstName: p.firstname||'', lastName: p.lastname||'', company: p.company||'' }

export async function getDeals(token: string, limit?: number): Promise<Array<{ id: string; dealname: string; amount: string; dealstage: string; }>>
  GET https://api.hubapi.com/crm/v3/objects/deals?limit={limit||20}&properties=dealname,amount,dealstage
  レスポンス: { results: [{ id, properties: { dealname, amount, dealstage } }] }

export async function createContact(token: string, email: string, firstName: string, lastName: string): Promise<{ id: string; }>
  POST https://api.hubapi.com/crm/v3/objects/contacts
  body: { properties: { email, firstname: firstName, lastname: lastName } }
  レスポンス: { id }

全関数: import { IntegrationError } from './errors'

【src/commands/hubspotcrm.ts を新規作成】
コマンド名: 'hubspotcrm', description: 'HubSpot CRMの連絡先・案件を管理します'
サブコマンド: contacts(limit integer optional) / deals(limit integer optional) / add(email/first_name/last_name string required)
vaultService から 'hubspot_access_token' 取得。未設定ガイド color: 0xFF7A59

---
=== TASK 3: Asanaタスク管理強化 ===

【src/integrations/asanatasks.ts を新規作成】

Asana API v1 を使用。認証: Bearer token

export async function getWorkspaces(token: string): Promise<Array<{ gid: string; name: string; }>>
  GET https://app.asana.com/api/1.0/workspaces
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { data: [{ gid, name }] }

export async function getMyTasks(token: string, workspaceGid: string): Promise<Array<{ gid: string; name: string; completed: boolean; due_on: string | null; }>>
  GET https://app.asana.com/api/1.0/tasks?workspace={workspaceGid}&assignee=me&opt_fields=gid,name,completed,due_on&limit=20
  レスポンス: { data: [{ gid, name, completed, due_on }] }

export async function createTask(token: string, workspaceGid: string, name: string, notes?: string): Promise<{ gid: string; name: string; }>
  POST https://app.asana.com/api/1.0/tasks
  body: { data: { workspace: workspaceGid, name, notes: notes||'' } }
  レスポンス: { data: { gid, name } }

全関数: import { IntegrationError } from './errors'

【src/commands/asanatasks.ts を新規作成】
コマンド名: 'asanatasks', description: 'Asanaのワークスペース・自分のタスクを管理します'
サブコマンド: workspaces / mytasks(workspace_id string required) / create(workspace_id/name string required, notes string optional)
vaultService から 'asana_access_token' 取得。未設定ガイド color: 0xF06A6A

---
=== TASK 4: Discord Webhook送信 ===

【src/integrations/discordwebhook.ts を新規作成】

export async function sendWebhookMessage(webhookUrl: string, content: string, username?: string): Promise<void>
  POST {webhookUrl}
  ヘッダー: Content-Type: application/json
  body: { content, username: username||'Aude' }
  204または200で成功

export async function sendEmbedMessage(webhookUrl: string, title: string, description: string, color?: number): Promise<void>
  POST {webhookUrl}
  body: { embeds: [{ title, description, color: color||0x5865F2 }] }

全関数: import { IntegrationError } from './errors'

【src/commands/discordwebhook.ts を新規作成】
コマンド名: 'discordwebhook', description: '外部DiscordサーバーのWebhookにメッセージを送信します'
サブコマンド: send(webhook_url/message string required, username string optional) / embed(webhook_url/title/description string required)
vaultService から 'discord_webhook_url' 取得。color: 0x5865F2

---
=== TASK 5: OpenAI API直接連携 ===

【src/integrations/openaiapi.ts を新規作成】

export async function listModels(token: string): Promise<Array<{ id: string; owned_by: string; }>>
  GET https://api.openai.com/v1/models
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { data: [{ id, owned_by }] }
  -> data.filter(m => m.id.startsWith('gpt') || m.id.startsWith('o1') || m.id.startsWith('o3'))

export async function chat(token: string, model: string, prompt: string, maxTokens?: number): Promise<{ content: string; usage: { prompt_tokens: number; completion_tokens: number; }; }>
  POST https://api.openai.com/v1/chat/completions
  ヘッダー: { Authorization: 'Bearer '+token, 'Content-Type': 'application/json' }
  body: { model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens||512 }
  レスポンス: { choices: [{ message: { content } }], usage: { prompt_tokens, completion_tokens } }
  -> { content: choices[0].message.content, usage }

全関数: import { IntegrationError } from './errors'

【src/commands/openaiapi.ts を新規作成】
コマンド名: 'openaiapi', description: 'OpenAI APIのモデル一覧確認・チャットを行います'
サブコマンド: models / chat(prompt string required, model string optional, max_tokens integer optional)
vaultService から 'openai_api_key' 取得。未設定ガイド color: 0x10A37F

---
=== TASK 6: Anthropic Claude API直接連携 ===

【src/integrations/anthropicapi.ts を新規作成】

export async function ask(apiKey: string, model: string, prompt: string, maxTokens?: number): Promise<{ content: string; model: string; input_tokens: number; output_tokens: number; }>
  POST https://api.anthropic.com/v1/messages
  ヘッダー: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
  body: { model: model||'claude-opus-4-5', max_tokens: maxTokens||1024, messages: [{ role: 'user', content: prompt }] }
  レスポンス: { content: [{ text }], model, usage: { input_tokens, output_tokens } }
  -> { content: content[0].text, model, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens }

全関数: import { IntegrationError } from './errors'

【src/commands/anthropicapi.ts を新規作成】
コマンド名: 'anthropicapi', description: 'Anthropic Claude APIにメッセージを送信します'
サブコマンド: ask(prompt string required, model string optional, max_tokens integer optional)
vaultService から 'anthropic_api_key' 取得。未設定ガイド color: 0xD97757

---
=== TASK 7: commandHandler.ts への登録 ===

src/handlers/commandHandler.ts を編集して以下をimportしてcommands配列に追加:
import { figmafilesCommand } from '../commands/figmafiles';
import { hubspotcrmCommand } from '../commands/hubspotcrm';
import { asanatasksCommand } from '../commands/asanatasks';
import { discordwebhookCommand } from '../commands/discordwebhook';
import { openaiapiCommand } from '../commands/openaiapi';
import { anthropicapiCommand } from '../commands/anthropicapi';

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
