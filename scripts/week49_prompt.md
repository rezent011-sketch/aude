=== Week49: Zendesk・Intercom・Freshdesk連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Zendesk連携 ===

【src/integrations/zendesk.ts を新規作成】

Zendesk REST API を使用。
認証: Basic認証 ({email}/token:{api_token} をBase64エンコード)
Base URL: https://{subdomain}.zendesk.com/api/v2

export async function getTickets(email: string, token: string, subdomain: string): Promise<Array<{ id: number; subject: string; status: string; priority: string; created_at: string; requester_name: string; }>>
  GET https://{subdomain}.zendesk.com/api/v2/tickets.json?per_page=20
  ヘッダー: Authorization: Basic {Buffer.from(email+'/token:'+token).toString('base64')}
  レスポンス: { tickets: [{ id, subject, status, priority, created_at, via: { source: { from: { name } } } }] }
  -> { id, subject, status, priority, created_at, requester_name: via.source.from.name || '' } の配列

export async function getTicket(email: string, token: string, subdomain: string, id: number): Promise<{ id: number; subject: string; status: string; description: string; }>
  GET https://{subdomain}.zendesk.com/api/v2/tickets/{id}.json
  レスポンス: { ticket: { id, subject, status, description } }

export async function createTicket(email: string, token: string, subdomain: string, subject: string, body: string, requesterEmail: string): Promise<{ id: number; subject: string; }>
  POST https://{subdomain}.zendesk.com/api/v2/tickets.json
  body: { ticket: { subject, comment: { body }, requester: { email: requesterEmail } } }
  レスポンス: { ticket: { id, subject } }

全関数: import { IntegrationError } from './errors'

【src/commands/zendesk.ts を新規作成】
コマンド名: 'zendesk', description: 'Zendeskのサポートチケットを管理します'
サブコマンド: tickets / ticket(id integer required) / create(subject/body/email string required)
vaultService から 'zendesk_email', 'zendesk_api_token', 'zendesk_subdomain' 取得。未設定ガイド color: 0x03363D

---
=== TASK 2: Intercom連携 ===

【src/integrations/intercom.ts を新規作成】

Intercom API (https://developers.intercom.com/) を使用。
認証: Bearer token
Base URL: https://api.intercom.io

export async function getConversations(token: string): Promise<Array<{ id: string; subject: string; state: string; created_at: number; assignee_name: string; }>>
  GET https://api.intercom.io/conversations?per_page=20
  ヘッダー: { Authorization: 'Bearer '+token, Accept: 'application/json', 'Intercom-Version': '2.10' }
  レスポンス: { conversations: [{ id, source: { subject }, state, created_at, assignee: { name } }] }
  -> { id, subject: source.subject||'(no subject)', state, created_at, assignee_name: assignee.name||'未割当' } の配列

export async function getContact(token: string, id: string): Promise<{ id: string; name: string; email: string; created_at: number; }>
  GET https://api.intercom.io/contacts/{id}
  レスポンス: { id, name, email, created_at }

export async function sendMessage(token: string, conversationId: string, body: string): Promise<void>
  POST https://api.intercom.io/conversations/{conversationId}/reply
  body: { message_type: 'comment', type: 'admin', body }
  レスポンス: { type } でなければIntegrationError

全関数: import { IntegrationError } from './errors'

【src/commands/intercom.ts を新規作成】
コマンド名: 'intercom', description: 'Intercomの会話・コンタクトを管理します'
サブコマンド: conversations / contact(id string required) / reply(conversation_id/message string required)
vaultService から 'intercom_access_token' 取得。未設定ガイド color: 0x286EFA

---
=== TASK 3: Freshdesk連携 ===

【src/integrations/freshdesk.ts を新規作成】

Freshdesk API (https://developers.freshdesk.com/) を使用。
認証: Basic認証 ({api_key}:X をBase64エンコード)
Base URL: https://{domain}.freshdesk.com/api/v2

export async function getTickets(apiKey: string, domain: string): Promise<Array<{ id: number; subject: string; status: number; priority: number; created_at: string; }>>
  GET https://{domain}.freshdesk.com/api/v2/tickets?per_page=20
  ヘッダー: Authorization: Basic {Buffer.from(apiKey+':X').toString('base64')}
  レスポンス: [{ id, subject, status, priority, created_at }]

export async function createTicket(apiKey: string, domain: string, subject: string, description: string, email: string, priority?: number): Promise<{ id: number; subject: string; }>
  POST https://{domain}.freshdesk.com/api/v2/tickets
  body: { subject, description, email, priority: priority||1, status: 2 }
  レスポンス: { id, subject }

export async function addNote(apiKey: string, domain: string, ticketId: number, body: string): Promise<void>
  POST https://{domain}.freshdesk.com/api/v2/tickets/{ticketId}/notes
  body: { body, private: false }

全関数: import { IntegrationError } from './errors'

【src/commands/freshdesk.ts を新規作成】
コマンド名: 'freshdesk', description: 'Freshdeskのサポートチケットを管理します'
サブコマンド: tickets / create(subject/description/email string required, priority integer optional) / note(ticket_id integer/body string required)
vaultService から 'freshdesk_api_key', 'freshdesk_domain' 取得。未設定ガイド color: 0x25C16F

---
=== TASK 4: commandHandler.ts への登録 ===
import { zendeskCommand } from '../commands/zendesk';
import { intercomCommand } from '../commands/intercom';
import { freshdeskCommand } from '../commands/freshdesk';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
