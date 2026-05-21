=== Week45: Shopify・PayPay for Business・Square連携 ===

既存のパターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Shopify連携 ===

【src/integrations/shopify.ts を新規作成】

Shopify Admin REST API を使用。
認証: X-Shopify-Access-Token ヘッダー
Base URL: https://{shop}.myshopify.com/admin/api/2024-01

以下の関数を実装:

export async function getOrders(token: string, shop: string, limit?: number): Promise<Array<{ id: number; order_number: number; total_price: string; financial_status: string; created_at: string; customer_name: string; }>>
  GET https://{shop}.myshopify.com/admin/api/2024-01/orders.json?limit={limit||10}&status=any
  ヘッダー: { 'X-Shopify-Access-Token': token }
  レスポンス: { orders: [{ id, order_number, total_price, financial_status, created_at, customer: { first_name, last_name } }] }
  -> { id, order_number, total_price, financial_status, created_at, customer_name: first_name+' '+last_name } の配列

export async function getProducts(token: string, shop: string, limit?: number): Promise<Array<{ id: number; title: string; status: string; variants_count: number; }>>
  GET https://{shop}.myshopify.com/admin/api/2024-01/products.json?limit={limit||10}
  レスポンス: { products: [{ id, title, status, variants: [] }] }
  -> { id, title, status, variants_count: variants.length } の配列

export async function getInventory(token: string, shop: string, productId: number): Promise<Array<{ variant_id: number; title: string; inventory_quantity: number; }>>
  GET https://{shop}.myshopify.com/admin/api/2024-01/products/{productId}/variants.json
  レスポンス: { variants: [{ id, title, inventory_quantity }] }
  -> { variant_id: id, title, inventory_quantity } の配列

全関数: import { IntegrationError } from './errors'

【src/commands/shopify.ts を新規作成】

SlashCommandBuilder コマンド名: 'shopify'
description: 'ShopifyのEC店舗の注文・商品・在庫を管理します'

サブコマンド:
  orders: 注文一覧
    options: limit(integer, optional, min:1 max:50)
  products: 商品一覧
    options: limit(integer, optional)
  inventory: 在庫確認
    options: product_id(integer, required)

vaultService から 'shopify_access_token', 'shopify_shop_domain' を取得。
未設定時ガイド: color 0x95BF47、'shopify_access_token と shopify_shop_domain を /vault set で設定してください'

---
=== TASK 2: PayPay for Business連携 ===

【src/integrations/paypay.ts を新規作成】

PayPay Open Payment API を使用。
認証: HMAC-SHA256署名（API Key + Secret）
Base URL: https://api.paypay.ne.jp

以下の関数を実装（PayPayのHMAC認証はシンプル化して実装）:

export async function createPayment(apiKey: string, apiSecret: string, merchantPaymentId: string, amount: number, description: string): Promise<{ paymentUrl: string; merchantPaymentId: string; }>
  POST https://api.paypay.ne.jp/v2/qrcode
  ヘッダー: { Authorization: 'hmac OPA-Auth ' + apiKey + ':' + Buffer.from(apiSecret).toString('base64'), 'Content-Type': 'application/json' }
  body: { merchantPaymentId, amount: { amount, currency: 'JPY' }, orderDescription: description, codeType: 'ORDER_QR', isAuthorization: false }
  レスポンス: { data: { url, merchantPaymentId } }

export async function getPaymentStatus(apiKey: string, apiSecret: string, merchantPaymentId: string): Promise<{ status: string; amount: number; }>
  GET https://api.paypay.ne.jp/v2/qrcode/orders/{merchantPaymentId}
  同じヘッダー
  レスポンス: { data: { status, amount: { amount } } }

全関数: import { IntegrationError } from './errors'

【src/commands/paypay.ts を新規作成】

SlashCommandBuilder コマンド名: 'paypay'
description: 'PayPay for Businessで決済QRの作成・状態確認を行います'

サブコマンド:
  create: 決済QRコード作成
    options: amount(integer, required), description(string, required), payment_id(string, optional, description: '決済ID省略時は自動生成')
  status: 決済状態確認
    options: payment_id(string, required)

vaultService から 'paypay_api_key', 'paypay_api_secret' を取得。
未設定時ガイド: color 0xFF0033

---
=== TASK 3: Square連携 ===

【src/integrations/square.ts を新規作成】

Square API (https://developer.squareup.com/reference/square) を使用。
認証: Bearer token
Base URL: https://connect.squareup.com/v2

以下の関数を実装:

export async function listLocations(token: string): Promise<Array<{ id: string; name: string; address: string; }>>
  GET https://connect.squareup.com/v2/locations
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { locations: [{ id, name, address: { address_line_1 } }] }
  -> { id, name, address: address_line_1 || '' } の配列

export async function listTransactions(token: string, locationId: string): Promise<Array<{ id: string; amount: number; currency: string; created_at: string; status: string; }>>
  GET https://connect.squareup.com/v2/locations/{locationId}/transactions
  レスポンス: { transactions: [{ id, tenders: [{ amount_money: { amount, currency } }], created_at, status }] }
  -> { id, amount: tenders[0].amount_money.amount, currency: tenders[0].amount_money.currency, created_at, status } の配列

export async function createInvoice(token: string, locationId: string, amount: number, description: string): Promise<{ id: string; status: string; }>
  POST https://connect.squareup.com/v2/invoices
  body: { invoice: { location_id: locationId, primary_recipient: {}, payment_requests: [{ request_type: 'BALANCE', due_date: new Date().toISOString().split('T')[0], fixed_amount_requested_money: { amount, currency: 'JPY' } }], description } }
  レスポンス: { invoice: { id, status } }

【src/commands/square.ts を新規作成】

SlashCommandBuilder コマンド名: 'square'
description: 'Squareの店舗・決済・請求書を管理します'

サブコマンド:
  locations: 店舗一覧
  transactions: 決済一覧
    options: location_id(string, required)
  invoice: 請求書作成
    options: location_id(string, required), amount(integer, required), description(string, required)

vaultService から 'square_access_token' を取得。
未設定時ガイド: color 0x3E4348

---
=== TASK 4: commandHandler.ts への登録 ===

src/handlers/commandHandler.ts を編集:
1. import追加: shopifyCommand, paypayCommand, squareCommand
2. commands配列に追加

---
注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
