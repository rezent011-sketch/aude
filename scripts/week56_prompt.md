=== Week56: Calendly・Typeform・DocuSign連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Calendly連携 ===

【src/integrations/calendly.ts を新規作成】

Calendly API v2 を使用。
認証: Bearer token
Base URL: https://api.calendly.com

export async function getCurrentUser(token: string): Promise<{ uri: string; name: string; email: string; scheduling_url: string; }>
  GET https://api.calendly.com/users/me
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { resource: { uri, name, email, scheduling_url } }

export async function getEventTypes(token: string, userUri: string): Promise<Array<{ uri: string; name: string; duration: number; scheduling_url: string; active: boolean; }>>
  GET https://api.calendly.com/event_types?user={userUri}
  レスポンス: { collection: [{ uri, name, duration, scheduling_url, active }] }

export async function getScheduledEvents(token: string, userUri: string): Promise<Array<{ uri: string; name: string; start_time: string; end_time: string; status: string; }>>
  GET https://api.calendly.com/scheduled_events?user={userUri}&sort=start_time:asc&count=10
  レスポンス: { collection: [{ uri, name, start_time, end_time, status }] }

全関数: import { IntegrationError } from './errors'

【src/commands/calendly.ts を新規作成】
コマンド名: 'calendly'
description: 'Calendlyの予約・イベントタイプを管理します'
サブコマンド: me / event_types / scheduled(予約済みイベント一覧)
vaultService から 'calendly_access_token' 取得。未設定ガイド color: 0x006BFF

---
=== TASK 2: Typeform連携 ===

【src/integrations/typeform.ts を新規作成】

Typeform API v1 を使用。
認証: Bearer token
Base URL: https://api.typeform.com

export async function getForms(token: string): Promise<Array<{ id: string; title: string; last_updated_at: string; response_count: number; }>>
  GET https://api.typeform.com/forms?page_size=20
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { items: [{ id, title, last_updated_at, _links }] }
  -> { id, title, last_updated_at, response_count: 0 } の配列（response_countは別途取得不要）

export async function getResponses(token: string, formId: string, pageSize?: number): Promise<Array<{ submitted_at: string; answers: Array<{ field: { ref: string }; type: string; text?: string; choice?: { label: string }; }> }>>
  GET https://api.typeform.com/forms/{formId}/responses?page_size={pageSize||10}
  レスポンス: { items: [{ submitted_at, answers: [{ field: { ref }, type, text, choice }] }] }

export async function getFormSummary(token: string, formId: string): Promise<{ id: string; title: string; response_count: number; }>
  GET https://api.typeform.com/forms/{formId}
  レスポンス: { id, title } ※response_countはinsightsから別途取得するが省略してresponse_count:0で返す

全関数: import { IntegrationError } from './errors'

【src/commands/typeform.ts を新規作成】
コマンド名: 'typeform'
description: 'Typeformのフォーム・回答を確認します'
サブコマンド: forms / responses(form_id string required, limit integer optional) / summary(form_id string required)
vaultService から 'typeform_access_token' 取得。未設定ガイド color: 0x262627

---
=== TASK 3: DocuSign連携 ===

【src/integrations/docusign.ts を新規作成】

DocuSign eSignature REST API v2.1 を使用。
認証: Bearer token
Base URL: https://demo.docusign.net/restapi/v2.1/accounts/{accountId}

export async function getEnvelopes(token: string, accountId: string): Promise<Array<{ envelopeId: string; subject: string; status: string; sentDateTime: string; }>>
  GET https://demo.docusign.net/restapi/v2.1/accounts/{accountId}/envelopes?from_date={30日前のISO日付}
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { envelopes: [{ envelopeId, emailSubject, status, sentDateTime }] }
  -> { envelopeId, subject: emailSubject, status, sentDateTime } の配列

export async function getEnvelope(token: string, accountId: string, envelopeId: string): Promise<{ envelopeId: string; subject: string; status: string; recipients: Array<{ name: string; email: string; status: string; }> }>
  GET https://demo.docusign.net/restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}/recipients
  レスポンス: { signers: [{ name, email, status }] }
  別途 envelope情報も GET https://demo.docusign.net/restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId} で取得
  -> { envelopeId, subject: envelope.emailSubject, status: envelope.status, recipients: signers }

全関数: import { IntegrationError } from './errors'

【src/commands/docusign.ts を新規作成】
コマンド名: 'docusign'
description: 'DocuSignの電子署名封筒を管理します'
サブコマンド: envelopes(envelope一覧) / envelope(id string required)
vaultService から 'docusign_access_token', 'docusign_account_id' 取得。未設定ガイド color: 0xFFCC00

---
=== TASK 4: commandHandler.ts への登録 ===
import { calendlyCommand } from '../commands/calendly';
import { typeformCommand } from '../commands/typeform';
import { docusignCommand } from '../commands/docusign';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
