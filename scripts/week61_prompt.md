=== Week61: Sentry・LaunchDarkly・PagerDuty強化・Cloudflare・Heroku連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Sentry連携 ===

【src/integrations/sentry.ts を新規作成】

Sentry API v0 を使用。認証: Bearer token (Auth Token)
Base URL: https://sentry.io/api/0

export async function getOrganizations(token: string): Promise<Array<{ id: string; slug: string; name: string; }>>
  GET https://sentry.io/api/0/organizations/
  ヘッダー: Authorization: Bearer {token}
  レスポンス: [{ id, slug, name }]

export async function getIssues(token: string, orgSlug: string, projectSlug: string): Promise<Array<{ id: string; title: string; status: string; level: string; lastSeen: string; count: string; }>>
  GET https://sentry.io/api/0/projects/{orgSlug}/{projectSlug}/issues/?limit=20
  レスポンス: [{ id, title, status, level, lastSeen, count }]

export async function getProjects(token: string, orgSlug: string): Promise<Array<{ id: string; slug: string; name: string; platform: string; }>>
  GET https://sentry.io/api/0/organizations/{orgSlug}/projects/
  レスポンス: [{ id, slug, name, platform }]

全関数: import { IntegrationError } from './errors'

【src/commands/sentry.ts を新規作成】
コマンド名: 'sentry', description: 'Sentryのエラー・プロジェクトを監視します'
サブコマンド: orgs / projects(org_slug string required) / issues(org_slug/project_slug string required)
vaultService から 'sentry_auth_token' 取得。未設定ガイド color: 0x362D59

---
=== TASK 2: Cloudflare連携 ===

【src/integrations/cloudflare.ts を新規作成】

Cloudflare API v4 を使用。認証: Bearer token
Base URL: https://api.cloudflare.com/client/v4

export async function getZones(token: string): Promise<Array<{ id: string; name: string; status: string; plan: string; }>>
  GET https://api.cloudflare.com/client/v4/zones?per_page=20
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { result: [{ id, name, status, plan: { name } }] }
  -> { id, name, status, plan: plan.name }

export async function getDnsRecords(token: string, zoneId: string): Promise<Array<{ id: string; type: string; name: string; content: string; ttl: number; }>>
  GET https://api.cloudflare.com/client/v4/zones/{zoneId}/dns_records
  レスポンス: { result: [{ id, type, name, content, ttl }] }

export async function purgeCache(token: string, zoneId: string): Promise<{ id: string; }>
  POST https://api.cloudflare.com/client/v4/zones/{zoneId}/purge_cache
  body: { purge_everything: true }
  レスポンス: { result: { id } }

全関数: import { IntegrationError } from './errors'

【src/commands/cloudflare.ts を新規作成】
コマンド名: 'cloudflare', description: 'CloudflareのDNS・キャッシュを管理します'
サブコマンド: zones / dns(zone_id string required) / purge(zone_id string required)
vaultService から 'cloudflare_api_token' 取得。未設定ガイド color: 0xF48120

---
=== TASK 3: Heroku連携 ===

【src/integrations/heroku.ts を新規作成】

Heroku Platform API v3 を使用。認証: Bearer token
Base URL: https://api.heroku.com

export async function getApps(token: string): Promise<Array<{ id: string; name: string; web_url: string; stack: string; region: string; }>>
  GET https://api.heroku.com/apps
  ヘッダー: { Authorization: 'Bearer '+token, Accept: 'application/vnd.heroku+json; version=3' }
  レスポンス: [{ id, name, web_url, stack: { name }, region: { name } }]
  -> { id, name, web_url, stack: stack.name, region: region.name }

export async function getDynos(token: string, appName: string): Promise<Array<{ id: string; type: string; state: string; size: string; }>>
  GET https://api.heroku.com/apps/{appName}/dynos
  レスポンス: [{ id, type, state, size }]

export async function restartDynos(token: string, appName: string): Promise<void>
  DELETE https://api.heroku.com/apps/{appName}/dynos
  レスポンス: 200/202 で成功

全関数: import { IntegrationError } from './errors'

【src/commands/heroku.ts を新規作成】
コマンド名: 'heroku', description: 'Herokuのアプリ・Dynoを管理します'
サブコマンド: apps / dynos(app_name string required) / restart(app_name string required)
vaultService から 'heroku_api_token' 取得。未設定ガイド color: 0x79589F

---
=== TASK 4: LaunchDarkly連携 ===

【src/integrations/launchdarkly.ts を新規作成】

LaunchDarkly REST API v2 を使用。認証: Authorization: {api_key}
Base URL: https://app.launchdarkly.com/api/v2

export async function getProjects(token: string): Promise<Array<{ key: string; name: string; }>>
  GET https://app.launchdarkly.com/api/v2/projects
  ヘッダー: Authorization: {token}
  レスポンス: { items: [{ key, name }] }

export async function getFlags(token: string, projectKey: string): Promise<Array<{ key: string; name: string; kind: string; on: boolean; }>>
  GET https://app.launchdarkly.com/api/v2/flags/{projectKey}
  レスポンス: { items: [{ key, name, kind, environments: { production: { on } } }] }
  -> { key, name, kind, on: environments?.production?.on || false }

export async function toggleFlag(token: string, projectKey: string, flagKey: string, enabled: boolean): Promise<void>
  PATCH https://app.launchdarkly.com/api/v2/flags/{projectKey}/{flagKey}
  ヘッダー: { Authorization: token, 'Content-Type': 'application/json; domain-model=launchdarkly.semanticpatch' }
  body: { environmentKey: 'production', instructions: [{ kind: enabled ? 'turnFlagOn' : 'turnFlagOff' }] }

全関数: import { IntegrationError } from './errors'

【src/commands/launchdarkly.ts を新規作成】
コマンド名: 'launchdarkly', description: 'LaunchDarklyのフィーチャーフラグを管理します'
サブコマンド: projects / flags(project_key string required) / toggle(project_key/flag_key string required, enabled boolean required)
vaultService から 'launchdarkly_api_token' 取得。未設定ガイド color: 0x405BFF

---
=== TASK 5: Statuspage連携 ===

【src/integrations/statuspage.ts を新規作成】

Statuspage API v1 を使用。認証: Authorization: OAuth {api_key}
Base URL: https://api.statuspage.io/v1

export async function getPages(token: string): Promise<Array<{ id: string; name: string; subdomain: string; page_description: string; }>>
  GET https://api.statuspage.io/v1/pages
  ヘッダー: Authorization: OAuth {token}
  レスポンス: [{ id, name, subdomain, page_description }]

export async function getIncidents(token: string, pageId: string): Promise<Array<{ id: string; name: string; status: string; impact: string; created_at: string; }>>
  GET https://api.statuspage.io/v1/pages/{pageId}/incidents?limit=10
  レスポンス: [{ id, name, status, impact, created_at }]

export async function createIncident(token: string, pageId: string, name: string, status: string, impact: string, body: string): Promise<{ id: string; name: string; }>
  POST https://api.statuspage.io/v1/pages/{pageId}/incidents
  body: { incident: { name, status, impact_override: impact, body } }
  レスポンス: { id, name }

全関数: import { IntegrationError } from './errors'

【src/commands/statuspage.ts を新規作成】
コマンド名: 'statuspage', description: 'Statuspageのインシデント・ステータスを管理します'
サブコマンド: pages / incidents(page_id string required) / create(page_id/name/status/impact/body string required)
vaultService から 'statuspage_api_key' 取得。未設定ガイド color: 0x39A845

---
=== TASK 6: commandHandler.ts への登録 ===
import { sentryCommand } from '../commands/sentry';
import { cloudflareCommand } from '../commands/cloudflare';
import { herokuCommand } from '../commands/heroku';
import { launchdarklyCommand } from '../commands/launchdarkly';
import { statuspageCommand } from '../commands/statuspage';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
