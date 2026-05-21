=== Week53: Box・Dropbox・Confluence連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Box連携 ===

【src/integrations/box.ts を新規作成】

Box API v2 を使用。
認証: Bearer token
Base URL: https://api.box.com/2.0

export async function listFiles(token: string, folderId?: string): Promise<Array<{ id: string; name: string; type: string; size: number; modified_at: string; }>>
  GET https://api.box.com/2.0/folders/{folderId||'0'}/items
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { entries: [{ id, name, type, size, modified_at }] }

export async function getFile(token: string, fileId: string): Promise<{ id: string; name: string; size: number; download_url: string; }>
  GET https://api.box.com/2.0/files/{fileId}
  レスポンス: { id, name, size, download_url }

export async function searchFiles(token: string, query: string): Promise<Array<{ id: string; name: string; type: string; parent_name: string; }>>
  GET https://api.box.com/2.0/search?query={encodeURIComponent(query)}&limit=20
  レスポンス: { entries: [{ id, name, type, parent: { name } }] }
  -> { id, name, type, parent_name: parent.name }

全関数: import { IntegrationError } from './errors'

【src/commands/box.ts を新規作成】
コマンド名: 'box'
description: 'Boxのファイル・フォルダを管理します'
サブコマンド: files(folder_id string optional) / file(id string required) / search(query string required)
vaultService から 'box_access_token' 取得。未設定ガイド color: 0x0061D5

---
=== TASK 2: Dropbox連携 ===

【src/integrations/dropbox.ts を新規作成】

Dropbox API v2 を使用。
認証: Bearer token
Base URL: https://api.dropboxapi.com/2

export async function listFolder(token: string, path?: string): Promise<Array<{ id: string; name: string; path_display: string; is_folder: boolean; size?: number; }>>
  POST https://api.dropboxapi.com/2/files/list_folder
  ヘッダー: { Authorization: 'Bearer '+token, 'Content-Type': 'application/json' }
  body: { path: path || '', recursive: false }
  レスポンス: { entries: [{ id, name, path_display, '.tag': 'folder'|'file', size }] }
  -> { id, name, path_display, is_folder: entry['.tag'] === 'folder', size: entry.size }

export async function getMetadata(token: string, path: string): Promise<{ id: string; name: string; path_display: string; size?: number; server_modified?: string; }>
  POST https://api.dropboxapi.com/2/files/get_metadata
  body: { path }
  レスポンス: { id, name, path_display, size, server_modified }

export async function search(token: string, query: string): Promise<Array<{ name: string; path_display: string; }>>
  POST https://api.dropboxapi.com/2/files/search_v2
  body: { query }
  レスポンス: { matches: [{ metadata: { metadata: { name, path_display } } }] }
  -> { name: m.metadata.metadata.name, path_display: m.metadata.metadata.path_display }

全関数: import { IntegrationError } from './errors'

【src/commands/dropbox.ts を新規作成】
コマンド名: 'dropbox'
description: 'Dropboxのファイル・フォルダを操作します'
サブコマンド: list(path string optional) / info(path string required) / search(query string required)
vaultService から 'dropbox_access_token' 取得。未設定ガイド color: 0x0061FF

---
=== TASK 3: Confluence連携 ===

【src/integrations/confluence.ts を新規作成】

Confluence Cloud REST API v2 を使用。
認証: Basic認証 ({email}:{api_token} をBase64エンコード)
Base URL: https://{domain}.atlassian.net/wiki/api/v2

export async function getSpaces(email: string, token: string, domain: string): Promise<Array<{ id: string; key: string; name: string; type: string; }>>
  GET https://{domain}.atlassian.net/wiki/api/v2/spaces?limit=20
  ヘッダー: Authorization: Basic {Buffer.from(email+':'+token).toString('base64')}
  レスポンス: { results: [{ id, key, name, type }] }

export async function searchPages(email: string, token: string, domain: string, query: string): Promise<Array<{ id: string; title: string; spaceKey: string; url: string; }>>
  GET https://{domain}.atlassian.net/wiki/rest/api/content/search?cql=type=page AND text~"{query}"&limit=10
  レスポンス: { results: [{ id, title, space: { key }, _links: { webui } }] }
  -> { id, title, spaceKey: space.key, url: 'https://'+domain+'.atlassian.net/wiki'+_links.webui }

export async function createPage(email: string, token: string, domain: string, spaceKey: string, title: string, body: string): Promise<{ id: string; title: string; url: string; }>
  POST https://{domain}.atlassian.net/wiki/rest/api/content
  body: { type: 'page', title, space: { key: spaceKey }, body: { storage: { value: body, representation: 'storage' } } }
  レスポンス: { id, title, _links: { webui } }
  -> { id, title, url: 'https://'+domain+'.atlassian.net/wiki'+_links.webui }

全関数: import { IntegrationError } from './errors'

【src/commands/confluence.ts を新規作成】
コマンド名: 'confluence'
description: 'Confluenceのスペース・ページを管理します'
サブコマンド: spaces / search(query string required) / create(space_key/title/body string required)
vaultService から 'confluence_email', 'confluence_api_token', 'confluence_domain' 取得。未設定ガイド color: 0x0052CC

---
=== TASK 4: commandHandler.ts への登録 ===
import { boxCommand } from '../commands/box';
import { dropboxCommand } from '../commands/dropbox';
import { confluenceCommand } from '../commands/confluence';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
