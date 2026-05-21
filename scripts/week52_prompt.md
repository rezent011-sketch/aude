=== Week52: Salesforce・Pipedrive・ActiveCampaign連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Salesforce連携 ===

【src/integrations/salesforce.ts を新規作成】

Salesforce REST API を使用。
認証: Bearer token (OAuth2アクセストークン)
Base URL: https://{instance}.salesforce.com/services/data/v58.0

export async function query(token: string, instance: string, soql: string): Promise<Array<Record<string, unknown>>>
  GET https://{instance}.salesforce.com/services/data/v58.0/query?q={encodeURIComponent(soql)}
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { records: [...] }

export async function getAccounts(token: string, instance: string): Promise<Array<{ Id: string; Name: string; Industry: string; AnnualRevenue: number; }>>
  query(token, instance, 'SELECT Id, Name, Industry, AnnualRevenue FROM Account LIMIT 20') を呼び出し
  ->型キャストして返す

export async function getOpportunities(token: string, instance: string): Promise<Array<{ Id: string; Name: string; StageName: string; Amount: number; CloseDate: string; }>>
  query(token, instance, 'SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT 20') を呼び出し

export async function createLead(token: string, instance: string, firstName: string, lastName: string, company: string, email: string): Promise<{ id: string; success: boolean; }>
  POST https://{instance}.salesforce.com/services/data/v58.0/sobjects/Lead
  body: { FirstName: firstName, LastName: lastName, Company: company, Email: email }
  レスポンス: { id, success }

全関数: import { IntegrationError } from './errors'

【src/commands/salesforce.ts を新規作成】
コマンド名: 'salesforce'
description: 'Salesforceの取引先・商談・リードを管理します'
サブコマンド: accounts / opportunities / lead(first_name/last_name/company/email string required)
vaultService から 'salesforce_access_token', 'salesforce_instance_url' 取得。未設定ガイド color: 0x00A1E0

---
=== TASK 2: Pipedrive連携 ===

【src/integrations/pipedrive.ts を新規作成】

Pipedrive API v1 を使用。
認証: クエリパラメータ api_token={token}
Base URL: https://api.pipedrive.com/v1

export async function getDeals(token: string, limit?: number): Promise<Array<{ id: number; title: string; status: string; value: number; currency: string; org_name: string; }>>
  GET https://api.pipedrive.com/v1/deals?api_token={token}&limit={limit||20}
  レスポンス: { data: [{ id, title, status, value, currency, org_name }] }

export async function getPersons(token: string, limit?: number): Promise<Array<{ id: number; name: string; email: string; phone: string; org_name: string; }>>
  GET https://api.pipedrive.com/v1/persons?api_token={token}&limit={limit||20}
  レスポンス: { data: [{ id, name, email: [{ value }], phone: [{ value }], org_name }] }
  -> email: email[0]?.value || '', phone: phone[0]?.value || ''

export async function createDeal(token: string, title: string, value?: number): Promise<{ id: number; title: string; }>
  POST https://api.pipedrive.com/v1/deals?api_token={token}
  body: { title, value: value || 0 }
  レスポンス: { data: { id, title } }

全関数: import { IntegrationError } from './errors'

【src/commands/pipedrive.ts を新規作成】
コマンド名: 'pipedrive'
description: 'Pipedriveの案件・連絡先を管理します'
サブコマンド: deals(limit integer optional) / persons(limit integer optional) / create(title string required, value integer optional)
vaultService から 'pipedrive_api_token' 取得。未設定ガイド color: 0x1F7244

---
=== TASK 3: ActiveCampaign連携 ===

【src/integrations/activecampaign.ts を新規作成】

ActiveCampaign API v3 を使用。
認証: Api-Token ヘッダー
Base URL: https://{account}.api-us1.com/api/3

export async function getContacts(token: string, account: string, limit?: number): Promise<Array<{ id: string; email: string; firstName: string; lastName: string; }>>
  GET https://{account}.api-us1.com/api/3/contacts?limit={limit||20}
  ヘッダー: { 'Api-Token': token }
  レスポンス: { contacts: [{ id, email, firstName, lastName }] }

export async function getLists(token: string, account: string): Promise<Array<{ id: string; name: string; subscriberCount: number; }>>
  GET https://{account}.api-us1.com/api/3/lists
  レスポンス: { lists: [{ id, name, subscriberCount }] }

export async function createContact(token: string, account: string, email: string, firstName?: string, lastName?: string): Promise<{ id: string; email: string; }>
  POST https://{account}.api-us1.com/api/3/contacts
  body: { contact: { email, firstName: firstName||'', lastName: lastName||'' } }
  レスポンス: { contact: { id, email } }

全関数: import { IntegrationError } from './errors'

【src/commands/activecampaign.ts を新規作成】
コマンド名: 'activecampaign'
description: 'ActiveCampaignのコンタクト・リストを管理します'
サブコマンド: contacts(limit integer optional) / lists / add(email string required, first_name/last_name string optional)
vaultService から 'activecampaign_api_token', 'activecampaign_account' 取得。未設定ガイド color: 0x356AE6

---
=== TASK 4: commandHandler.ts への登録 ===
import { salesforceCommand } from '../commands/salesforce';
import { pipedriveCommand } from '../commands/pipedrive';
import { activecampaignCommand } from '../commands/activecampaign';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
