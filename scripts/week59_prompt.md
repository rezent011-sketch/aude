=== Week59: Figma強化・Canva・Miro・Loom連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Miro連携 ===

【src/integrations/miro.ts を新規作成】

Miro REST API v2 を使用。認証: Bearer token
Base URL: https://api.miro.com/v2

export async function getBoards(token: string): Promise<Array<{ id: string; name: string; description: string; viewLink: string; }>>
  GET https://api.miro.com/v2/boards?limit=20
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { data: [{ id, name, description, viewLink }] }

export async function getBoard(token: string, boardId: string): Promise<{ id: string; name: string; createdAt: string; modifiedAt: string; collaborators: number; }>
  GET https://api.miro.com/v2/boards/{boardId}
  レスポンス: { id, name, createdAt, modifiedAt, collaboratorCount }
  -> { id, name, createdAt, modifiedAt, collaborators: collaboratorCount }

export async function createStickyNote(token: string, boardId: string, content: string, color?: string): Promise<{ id: string; content: string; }>
  POST https://api.miro.com/v2/boards/{boardId}/sticky_notes
  body: { data: { content, shape: 'square' }, style: { fillColor: color||'light_yellow' } }
  レスポンス: { id, data: { content } }
  -> { id, content: data.content }

全関数: import { IntegrationError } from './errors'

【src/commands/miro.ts を新規作成】
コマンド名: 'miro', description: 'Miroのボード・付箋を管理します'
サブコマンド: boards / board(id string required) / sticky(board_id/content string required, color string optional)
vaultService から 'miro_access_token' 取得。未設定ガイド color: 0xFFD02F

---
=== TASK 2: Loom連携 ===

【src/integrations/loom.ts を新規作成】

Loom API v1 を使用。認証: Bearer token
Base URL: https://www.loom.com/v1

export async function getVideos(token: string): Promise<Array<{ id: string; title: string; duration: number; created_at: string; share_url: string; }>>
  GET https://www.loom.com/v1/recordings?limit=20
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { videos: [{ id, title, duration, created_at, share_url }] }

export async function getVideo(token: string, videoId: string): Promise<{ id: string; title: string; duration: number; view_count: number; share_url: string; }>
  GET https://www.loom.com/v1/recordings/{videoId}
  レスポンス: { id, title, duration, view_count, share_url }

全関数: import { IntegrationError } from './errors'

【src/commands/loom.ts を新規作成】
コマンド名: 'loom', description: 'Loomの録画動画を管理します'
サブコマンド: videos / video(id string required)
vaultService から 'loom_access_token' 取得。未設定ガイド color: 0x625DF5

---
=== TASK 3: Webflow連携 ===

【src/integrations/webflow.ts を新規作成】

Webflow API v2 を使用。認証: Bearer token
Base URL: https://api.webflow.com/v2

export async function getSites(token: string): Promise<Array<{ id: string; displayName: string; shortName: string; lastPublished: string; }>>
  GET https://api.webflow.com/v2/sites
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { sites: [{ id, displayName, shortName, lastPublished }] }

export async function getCollections(token: string, siteId: string): Promise<Array<{ id: string; displayName: string; slug: string; }>>
  GET https://api.webflow.com/v2/sites/{siteId}/collections
  レスポンス: { collections: [{ id, displayName, slug }] }

export async function publishSite(token: string, siteId: string): Promise<{ queued: boolean; }>
  POST https://api.webflow.com/v2/sites/{siteId}/publish
  body: { publishToWebflowSubdomain: true }
  レスポンス: { queued }

全関数: import { IntegrationError } from './errors'

【src/commands/webflow.ts を新規作成】
コマンド名: 'webflow', description: 'WebflowのサイトをDiscordから管理・公開します'
サブコマンド: sites / collections(site_id string required) / publish(site_id string required)
vaultService から 'webflow_access_token' 取得。未設定ガイド color: 0x146EF5

---
=== TASK 4: Stripe Billing追加連携（既存stripeapiとは別） ===

【src/integrations/stripebilling.ts を新規作成】

Stripe Billing API を使用。認証: Bearer (Secret Key)
Base URL: https://api.stripe.com/v1

export async function listSubscriptions(secretKey: string, limit?: number): Promise<Array<{ id: string; status: string; current_period_end: number; customer: string; plan_amount: number; plan_currency: string; }>>
  GET https://api.stripe.com/v1/subscriptions?limit={limit||20}
  ヘッダー: Authorization: Bearer {secretKey}
  レスポンス: { data: [{ id, status, current_period_end, customer, plan: { amount, currency } }] }
  -> { id, status, current_period_end, customer, plan_amount: plan.amount, plan_currency: plan.currency }

export async function listInvoices(secretKey: string, limit?: number): Promise<Array<{ id: string; customer_email: string; amount_due: number; status: string; created: number; }>>
  GET https://api.stripe.com/v1/invoices?limit={limit||20}
  レスポンス: { data: [{ id, customer_email, amount_due, status, created }] }

全関数: import { IntegrationError } from './errors'

【src/commands/stripebilling.ts を新規作成】
コマンド名: 'stripebilling', description: 'Stripeのサブスクリプション・請求書を管理します'
サブコマンド: subscriptions(limit integer optional) / invoices(limit integer optional)
vaultService から 'stripe_secret_key' 取得。未設定ガイド color: 0x635BFF

---
=== TASK 5: commandHandler.ts への登録 ===
import { miroCommand } from '../commands/miro';
import { loomCommand } from '../commands/loom';
import { webflowCommand } from '../commands/webflow';
import { stripebillingCommand } from '../commands/stripebilling';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
