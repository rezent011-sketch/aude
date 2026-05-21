=== Week50: Twilio・SendGrid・Stripe連携強化 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Twilio（SMS・電話）連携 ===

【src/integrations/twilio.ts を新規作成】

Twilio REST API を使用。
認証: Basic認証 (accountSid:authToken)
Base URL: https://api.twilio.com/2010-04-01

export async function sendSms(accountSid: string, authToken: string, from: string, to: string, body: string): Promise<{ sid: string; status: string; }>
  POST https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json
  ヘッダー: Authorization: Basic {Buffer.from(accountSid+':'+authToken).toString('base64')}, Content-Type: application/x-www-form-urlencoded
  body URLencoded: From={from}&To={to}&Body={body}
  レスポンス: { sid, status }

export async function getMessages(accountSid: string, authToken: string, limit?: number): Promise<Array<{ sid: string; from: string; to: string; body: string; status: string; date_sent: string; }>>
  GET https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json?PageSize={limit||20}
  レスポンス: { messages: [{ sid, from, to, body, status, date_sent }] }

export async function makeCall(accountSid: string, authToken: string, from: string, to: string, url: string): Promise<{ sid: string; status: string; }>
  POST https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Calls.json
  body URLencoded: From={from}&To={to}&Url={url}
  レスポンス: { sid, status }

全関数: import { IntegrationError } from './errors'

【src/commands/twilio.ts を新規作成】
コマンド名: 'twilio', description: 'TwilioでSMS送信・通話発信を行います'
サブコマンド: sms(from/to/message string required) / messages(limit integer optional) / call(from/to/twiml_url string required)
vaultService から 'twilio_account_sid', 'twilio_auth_token', 'twilio_from_number' 取得。未設定ガイド color: 0xF22F46

---
=== TASK 2: SendGrid（メール配信）連携 ===

【src/integrations/sendgrid.ts を新規作成】

SendGrid API (https://docs.sendgrid.com/) を使用。
認証: Bearer token
Base URL: https://api.sendgrid.com/v3

export async function sendEmail(apiKey: string, to: string, from: string, subject: string, text: string, html?: string): Promise<void>
  POST https://api.sendgrid.com/v3/mail/send
  ヘッダー: Authorization: Bearer {apiKey}, Content-Type: application/json
  body: { personalizations: [{ to: [{ email: to }] }], from: { email: from }, subject, content: [{ type: 'text/plain', value: text }, ...(html ? [{ type: 'text/html', value: html }] : [])] }
  202レスポンスで成功、それ以外はIntegrationError

export async function getStats(apiKey: string, startDate: string): Promise<Array<{ date: string; delivered: number; opens: number; clicks: number; }>>
  GET https://api.sendgrid.com/v3/stats?start_date={startDate}&aggregated_by=day
  レスポンス: [{ date, stats: [{ metrics: { delivered, opens, clicks } }] }]
  -> { date, delivered: stats[0].metrics.delivered, opens: stats[0].metrics.opens, clicks: stats[0].metrics.clicks } の配列

export async function getLists(apiKey: string): Promise<Array<{ id: string; name: string; contact_count: number; }>>
  GET https://api.sendgrid.com/v3/marketing/lists
  レスポンス: { result: [{ id, name, contact_count }] }

全関数: import { IntegrationError } from './errors'

【src/commands/sendgrid.ts を新規作成】
コマンド名: 'sendgrid', description: 'SendGridでメール送信・配信統計を確認します'
サブコマンド: send(to/from_email/subject/message string required) / stats(start_date string optional, 省略時は7日前) / lists
vaultService から 'sendgrid_api_key', 'sendgrid_from_email' 取得。未設定ガイド color: 0x1A82E2

---
=== TASK 3: Stripe（決済）連携強化 ===

【src/integrations/stripeapi.ts を新規作成】（既存のstripeManager.tsとは別、スラッシュコマンド用）

Stripe API (https://stripe.com/docs/api) を使用。
認証: Bearer token (SK_...)
Base URL: https://api.stripe.com/v1

export async function listCustomers(secretKey: string, limit?: number): Promise<Array<{ id: string; name: string; email: string; created: number; }>>
  GET https://api.stripe.com/v1/customers?limit={limit||20}
  ヘッダー: Authorization: Bearer {secretKey}
  レスポンス: { data: [{ id, name, email, created }] }

export async function listPayments(secretKey: string, limit?: number): Promise<Array<{ id: string; amount: number; currency: string; status: string; created: number; customer_email: string; }>>
  GET https://api.stripe.com/v1/payment_intents?limit={limit||20}
  レスポンス: { data: [{ id, amount, currency, status, created, receipt_email }] }
  -> { id, amount, currency, status, created, customer_email: receipt_email||'' } の配列

export async function createPaymentLink(secretKey: string, priceId: string, quantity?: number): Promise<{ id: string; url: string; }>
  POST https://api.stripe.com/v1/payment_links
  ヘッダー: Content-Type: application/x-www-form-urlencoded
  body URLencoded: line_items[0][price]={priceId}&line_items[0][quantity]={quantity||1}
  レスポンス: { id, url }

全関数: import { IntegrationError } from './errors'

【src/commands/stripeapi.ts を新規作成】
コマンド名: 'stripeapi', description: 'Stripe決済の顧客・支払い・決済リンクを管理します'
サブコマンド: customers(limit integer optional) / payments(limit integer optional) / paylink(price_id string required, quantity integer optional)
vaultService から 'stripe_secret_key' 取得。未設定ガイド color: 0x635BFF

---
=== TASK 4: commandHandler.ts への登録 ===
import { twilioCommand } from '../commands/twilio';
import { sendgridCommand } from '../commands/sendgrid';
import { stripeapiCommand } from '../commands/stripeapi';
commands配列に追加。

注意: npm installは不要（fetch標準）。TypeScript型エラーなし。git commitは不要。
