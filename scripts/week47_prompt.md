=== Week47: STORES・BASE・Wantedly連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: STORES連携 ===

【src/integrations/stores.ts を新規作成】

STORES API (https://developer.stores.jp/) を使用。
認証: Bearer token
Base URL: https://api.stores.jp/v1

export async function getShop(token: string): Promise<{ id: string; name: string; url: string; }>
  GET https://api.stores.jp/v1/shop
  レスポンス: { shop: { id, name, url } }

export async function getProducts(token: string, page?: number): Promise<Array<{ id: string; name: string; price: number; stock: number; status: string; }>>
  GET https://api.stores.jp/v1/items?page={page||1}
  レスポンス: { items: [{ id, name, price, stock_quantity, published }] }
  -> { id, name, price, stock: stock_quantity, status: published ? 'active' : 'inactive' } の配列

export async function getOrders(token: string, page?: number): Promise<Array<{ id: string; total: number; status: string; buyer_name: string; created_at: string; }>>
  GET https://api.stores.jp/v1/orders?page={page||1}
  レスポンス: { orders: [{ id, total_price, fulfillment_status, buyer: { name }, created_at }] }
  -> { id, total: total_price, status: fulfillment_status, buyer_name: buyer.name, created_at } の配列

全関数: import { IntegrationError } from './errors', fetch使用

【src/commands/stores.ts を新規作成】
コマンド名: 'stores', description: 'STORESのショップ・商品・注文を管理します'
サブコマンド: shop(ショップ情報) / products(商品一覧) / orders(注文一覧)
vaultService から 'stores_access_token' 取得。未設定ガイド color: 0xFF4B4B

---
=== TASK 2: BASE連携 ===

【src/integrations/base.ts を新規作成】

BASE API (https://devdocs.thebase.in/) を使用。
認証: Bearer token
Base URL: https://api.thebase.in/1

export async function getShopInfo(token: string): Promise<{ shop_name: string; shop_url: string; }>
  GET https://api.thebase.in/1/shop
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { shop: { shop_name, shop_url } }

export async function getItems(token: string, limit?: number): Promise<Array<{ item_id: number; title: string; price: number; stock: number; visible: number; }>>
  GET https://api.thebase.in/1/items?limit={limit||20}
  レスポンス: { items: [{ item_id, title, price, stock, visible }] }

export async function getOrders(token: string, limit?: number): Promise<Array<{ unique_key: string; total: number; order_status: string; name: string; ordered_at: string; }>>
  GET https://api.thebase.in/1/orders?limit={limit||20}
  レスポンス: { orders: [{ unique_key, total, order_status, name, ordered_at }] }

全関数: import { IntegrationError } from './errors'

【src/commands/base.ts を新規作成】
コマンド名: 'base', description: 'BASEのショップ・商品・注文を管理します'
サブコマンド: shop / items(limit integer optional) / orders(limit integer optional)
vaultService から 'base_access_token' 取得。未設定ガイド color: 0x000000

---
=== TASK 3: Wantedly連携 ===

【src/integrations/wantedly.ts を新規作成】

Wantedly API を使用。
認証: Bearer token
Base URL: https://www.wantedly.com/api/v1

export async function getCompanyProfile(token: string): Promise<{ id: number; name: string; description: string; }>
  GET https://www.wantedly.com/api/v1/companies/me
  レスポンス: { company: { id, name, description } }

export async function getJobPostings(token: string): Promise<Array<{ id: number; title: string; status: string; applicants_count: number; }>>
  GET https://www.wantedly.com/api/v1/job_postings
  レスポンス: { job_postings: [{ id, title, status, applicants_count }] }

export async function getApplicants(token: string, jobPostingId: number): Promise<Array<{ id: number; name: string; status: string; applied_at: string; }>>
  GET https://www.wantedly.com/api/v1/job_postings/{jobPostingId}/applicants
  レスポンス: { applicants: [{ id, name, status, created_at }] }
  -> { id, name, status, applied_at: created_at } の配列

全関数: import { IntegrationError } from './errors'

【src/commands/wantedly.ts を新規作成】
コマンド名: 'wantedly', description: 'Wantedlyの求人・応募者を管理します'
サブコマンド: profile / jobs / applicants(job_id integer required)
vaultService から 'wantedly_access_token' 取得。未設定ガイド color: 0x21BCAB

---
=== TASK 4: commandHandler.ts への登録 ===
import { storesCommand } from '../commands/stores';
import { baseCommand } from '../commands/base';
import { wantedlyCommand } from '../commands/wantedly';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
