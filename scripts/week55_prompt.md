=== Week55: Google Analytics・Facebook Ads・TikTok Ads連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Google Analytics 4連携 ===

【src/integrations/googleanalytics.ts を新規作成】

Google Analytics Data API v1 を使用。
認証: Bearer token
Base URL: https://analyticsdata.googleapis.com/v1beta

export async function runReport(token: string, propertyId: string, metrics: string[], dimensions: string[], dateRange?: { startDate: string; endDate: string }): Promise<Array<Record<string, string>>>
  POST https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
  ヘッダー: Authorization: Bearer {token}
  body: { dateRanges: [{ startDate: dateRange?.startDate||'7daysAgo', endDate: dateRange?.endDate||'today' }], metrics: metrics.map(name => ({ name })), dimensions: dimensions.map(name => ({ name })) }
  レスポンス: { rows: [{ metricValues: [{ value }], dimensionValues: [{ value }] }] }
  -> rows.map(row => { const obj: Record<string,string> = {}; dimensions.forEach((d,i) => obj[d]=row.dimensionValues[i].value); metrics.forEach((m,i) => obj[m]=row.metricValues[i].value); return obj; })

export async function getActiveUsers(token: string, propertyId: string): Promise<{ today: string; last7days: string; last30days: string; }>
  runReport を3回呼ぶ:
  - today: dateRange {startDate:'today', endDate:'today'}, metrics:['activeUsers']
  - 7days: {startDate:'7daysAgo', endDate:'today'}, metrics:['activeUsers']
  - 30days: {startDate:'30daysAgo', endDate:'today'}, metrics:['activeUsers']
  -> { today: rows[0]?.activeUsers||'0', last7days, last30days }

export async function getPageViews(token: string, propertyId: string): Promise<Array<{ pagePath: string; screenPageViews: string; }>>
  runReport(token, propertyId, ['screenPageViews'], ['pagePath'], {startDate:'7daysAgo', endDate:'today'}) で上位ページを取得

全関数: import { IntegrationError } from './errors'

【src/commands/googleanalytics.ts を新規作成】
コマンド名: 'googleanalytics'
description: 'Google Analytics 4のアクセス解析データを確認します'
サブコマンド: users(property_id string required) / pages(property_id string required)
vaultService から 'googleanalytics_access_token' 取得。未設定ガイド color: 0xE37400

---
=== TASK 2: Facebook / Meta Ads連携 ===

【src/integrations/metaads.ts を新規作成】

Meta Marketing API v19 を使用。
認証: access_token クエリパラメータ
Base URL: https://graph.facebook.com/v19.0

export async function getAdAccounts(token: string): Promise<Array<{ id: string; name: string; currency: string; account_status: number; }>>
  GET https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,currency,account_status&access_token={token}
  レスポンス: { data: [{ id, name, currency, account_status }] }

export async function getCampaigns(token: string, adAccountId: string): Promise<Array<{ id: string; name: string; status: string; objective: string; }>>
  GET https://graph.facebook.com/v19.0/{adAccountId}/campaigns?fields=id,name,status,objective&access_token={token}
  レスポンス: { data: [{ id, name, status, objective }] }

export async function getCampaignInsights(token: string, campaignId: string): Promise<{ impressions: string; clicks: string; spend: string; ctr: string; }>
  GET https://graph.facebook.com/v19.0/{campaignId}/insights?fields=impressions,clicks,spend,ctr&access_token={token}
  レスポンス: { data: [{ impressions, clicks, spend, ctr }] }
  -> data[0] またはゼロ値

全関数: import { IntegrationError } from './errors'

【src/commands/metaads.ts を新規作成】
コマンド名: 'metaads'
description: 'Meta（Facebook/Instagram）広告のキャンペーンを管理します'
サブコマンド: accounts / campaigns(account_id string required) / insights(campaign_id string required)
vaultService から 'metaads_access_token' 取得。未設定ガイド color: 0x1877F2

---
=== TASK 3: TikTok Ads連携 ===

【src/integrations/tiktokads.ts を新規作成】

TikTok Marketing API v1.3 を使用。
認証: Access-Token ヘッダー
Base URL: https://business-api.tiktok.com/open_api/v1.3

export async function getAdvertisers(token: string): Promise<Array<{ advertiser_id: string; advertiser_name: string; status: string; }>>
  GET https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/?access_token={token}
  レスポンス: { data: { list: [{ advertiser_id, advertiser_name, account_type }] } }
  -> { advertiser_id, advertiser_name, status: account_type } の配列

export async function getCampaigns(token: string, advertiserId: string): Promise<Array<{ campaign_id: string; campaign_name: string; status: string; budget: number; }>>
  GET https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id={advertiserId}&access_token={token}
  ヘッダー: { 'Access-Token': token }
  レスポンス: { data: { list: [{ campaign_id, campaign_name, operation_status, budget }] } }
  -> { campaign_id, campaign_name, status: operation_status, budget } の配列

全関数: import { IntegrationError } from './errors'

【src/commands/tiktokads.ts を新規作成】
コマンド名: 'tiktokads'
description: 'TikTok広告のアカウント・キャンペーンを確認します'
サブコマンド: advertisers / campaigns(advertiser_id string required)
vaultService から 'tiktokads_access_token' 取得。未設定ガイド color: 0x010101

---
=== TASK 4: commandHandler.ts への登録 ===
import { googleanalyticsCommand } from '../commands/googleanalytics';
import { metaadsCommand } from '../commands/metaads';
import { tiktokadsCommand } from '../commands/tiktokads';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
