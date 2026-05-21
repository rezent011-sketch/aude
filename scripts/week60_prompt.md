=== Week60: HubSpot強化・Amplitude・Mixpanel・Segment連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Amplitude（プロダクト分析）連携 ===

【src/integrations/amplitude.ts を新規作成】

Amplitude Analytics API を使用。認証: Basic認証 (api_key:secret_key)
Base URL: https://amplitude.com/api/2

export async function getActiveUsers(apiKey: string, secretKey: string, start: string, end: string): Promise<Array<{ date: string; value: number; }>>
  GET https://amplitude.com/api/2/users?start={start}&end={end}
  ヘッダー: Authorization: Basic {Buffer.from(apiKey+':'+secretKey).toString('base64')}
  レスポンス: { data: { series: [[value]], xValues: [date] } }
  -> xValues.map((date, i) => ({ date, value: series[0][i] || 0 }))

export async function getEventCounts(apiKey: string, secretKey: string, eventName: string, start: string, end: string): Promise<Array<{ date: string; count: number; }>>
  GET https://amplitude.com/api/2/events/segmentation?e={"event_type":"${eventName}"}&start={start}&end={end}&m=totals
  レスポンス: { data: { series: [[count]], xValues: [date] } }
  -> xValues.map((date, i) => ({ date, count: series[0][i] || 0 }))

全関数: import { IntegrationError } from './errors'

【src/commands/amplitude.ts を新規作成】
コマンド名: 'amplitude', description: 'Amplitudeのユーザー分析・イベント計測を確認します'
サブコマンド: users(start/end string optional, description: 'YYYYMMDD形式、省略時は過去7日') / events(event_name string required, start/end string optional)
vaultService から 'amplitude_api_key', 'amplitude_secret_key' 取得。未設定ガイド color: 0x1A1AFF

---
=== TASK 2: Mixpanel連携 ===

【src/integrations/mixpanel.ts を新規作成】

Mixpanel Data Export API を使用。認証: Basic認証 (service_account:secret)
Base URL: https://mixpanel.com/api/query

export async function getTopEvents(username: string, secret: string, projectId: string): Promise<Array<{ event: string; count: number; }>>
  GET https://mixpanel.com/api/query/events/top?project_id={projectId}&type=general&unit=day&interval=7
  ヘッダー: Authorization: Basic {Buffer.from(username+':'+secret).toString('base64')}, Accept: application/json
  レスポンス: { data: { series: { [eventName]: { [date]: count } } } }
  -> 各イベント名の合計カウントを計算して [{ event, count }] の配列で返す（降順ソート、上位10件）

export async function getFunnels(username: string, secret: string, projectId: string): Promise<Array<{ funnel_id: number; name: string; }>>
  GET https://mixpanel.com/api/query/funnels/list?project_id={projectId}
  レスポンス: [{ funnel_id, name }]

全関数: import { IntegrationError } from './errors'

【src/commands/mixpanel.ts を新規作成】
コマンド名: 'mixpanel', description: 'Mixpanelのイベント分析・ファネルを確認します'
サブコマンド: events(project_id string required) / funnels(project_id string required)
vaultService から 'mixpanel_service_account', 'mixpanel_secret' 取得。未設定ガイド color: 0x7856FF

---
=== TASK 3: Segment連携 ===

【src/integrations/segment.ts を新規作成】

Segment Public API を使用。認証: Bearer token
Base URL: https://api.segmentapis.com

export async function getSources(token: string): Promise<Array<{ id: string; name: string; slug: string; enabled: boolean; }>>
  GET https://api.segmentapis.com/sources?pagination.count=20
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { data: { sources: [{ id, name, slug, enabled }] } }

export async function getDestinations(token: string): Promise<Array<{ id: string; name: string; enabled: boolean; sourceId: string; }>>
  GET https://api.segmentapis.com/destinations?pagination.count=20
  レスポンス: { data: { destinations: [{ id, name, enabled, sourceId }] } }

全関数: import { IntegrationError } from './errors'

【src/commands/segment.ts を新規作成】
コマンド名: 'segment', description: 'SegmentのソースとDestinationを管理します'
サブコマンド: sources / destinations
vaultService から 'segment_access_token' 取得。未設定ガイド color: 0x52BD94

---
=== TASK 4: Postmark連携 ===

【src/integrations/postmark.ts を新規作成】

Postmark API を使用。認証: X-Postmark-Server-Token ヘッダー
Base URL: https://api.postmarkapp.com

export async function sendEmail(token: string, from: string, to: string, subject: string, textBody: string, htmlBody?: string): Promise<{ MessageID: string; SubmittedAt: string; }>
  POST https://api.postmarkapp.com/email
  ヘッダー: { 'X-Postmark-Server-Token': token, 'Content-Type': 'application/json' }
  body: { From: from, To: to, Subject: subject, TextBody: textBody, HtmlBody: htmlBody||'' }
  レスポンス: { MessageID, SubmittedAt }

export async function getStats(token: string): Promise<{ Sent: number; Bounced: number; Opens: number; Clicks: number; SpamComplaints: number; }>
  GET https://api.postmarkapp.com/stats/outbound
  レスポンス: { Sent, Bounced, Opens, Clicks, SpamComplaints }

export async function listTemplates(token: string): Promise<Array<{ TemplateId: number; Name: string; Active: boolean; TemplateType: string; }>>
  GET https://api.postmarkapp.com/templates?count=20
  レスポンス: { Templates: [{ TemplateId, Name, Active, TemplateType }] }

全関数: import { IntegrationError } from './errors'

【src/commands/postmark.ts を新規作成】
コマンド名: 'postmark', description: 'Postmarkのトランザクションメール送信・統計を管理します'
サブコマンド: send(from/to/subject/body string required) / stats / templates
vaultService から 'postmark_server_token' 取得。未設定ガイド color: 0xFFDD00

---
=== TASK 5: Vonage SMS連携 ===

【src/integrations/vonage.ts を新規作成】

Vonage SMS API を使用。認証: api_key + api_secret クエリパラメータ
Base URL: https://rest.nexmo.com

export async function sendSms(apiKey: string, apiSecret: string, from: string, to: string, text: string): Promise<{ messageId: string; status: string; }>
  POST https://rest.nexmo.com/sms/json
  ヘッダー: Content-Type: application/json
  body: { api_key: apiKey, api_secret: apiSecret, from, to, text }
  レスポンス: { messages: [{ 'message-id', status }] }
  -> { messageId: messages[0]['message-id'], status: messages[0].status }

export async function getBalance(apiKey: string, apiSecret: string): Promise<{ value: number; autoReload: boolean; }>
  GET https://rest.nexmo.com/account/get-balance?api_key={apiKey}&api_secret={apiSecret}
  レスポンス: { value, auto_reload }
  -> { value, autoReload: auto_reload }

全関数: import { IntegrationError } from './errors'

【src/commands/vonage.ts を新規作成】
コマンド名: 'vonage', description: 'VonageでSMS送信・残高確認を行います'
サブコマンド: sms(from/to/message string required) / balance
vaultService から 'vonage_api_key', 'vonage_api_secret' 取得。未設定ガイド color: 0x4B0082

---
=== TASK 6: commandHandler.ts への登録 ===
import { miroCommand } from '../commands/miro';
import { loomCommand } from '../commands/loom';
import { webflowCommand } from '../commands/webflow';
import { stripebillingCommand } from '../commands/stripebilling';
import { amplitudeCommand } from '../commands/amplitude';
import { mixpanelCommand } from '../commands/mixpanel';
import { segmentCommand } from '../commands/segment';
import { postmarkCommand } from '../commands/postmark';
import { vonageCommand } from '../commands/vonage';

※Week59分と合わせてすべてcommands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
