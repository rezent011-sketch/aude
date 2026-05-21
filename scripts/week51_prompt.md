=== Week51: Airtable・Monday.com・ClickUp連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Airtable連携 ===

【src/integrations/airtable.ts を新規作成】

Airtable REST API を使用。
認証: Bearer token
Base URL: https://api.airtable.com/v0

export async function listBases(token: string): Promise<Array<{ id: string; name: string; permissionLevel: string; }>>
  GET https://api.airtable.com/v0/meta/bases
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { bases: [{ id, name, permissionLevel }] }

export async function listRecords(token: string, baseId: string, tableId: string, maxRecords?: number): Promise<Array<{ id: string; fields: Record<string, unknown>; createdTime: string; }>>
  GET https://api.airtable.com/v0/{baseId}/{tableId}?maxRecords={maxRecords||20}
  レスポンス: { records: [{ id, fields, createdTime }] }

export async function createRecord(token: string, baseId: string, tableId: string, fields: Record<string, unknown>): Promise<{ id: string; fields: Record<string, unknown>; }>
  POST https://api.airtable.com/v0/{baseId}/{tableId}
  body: { fields }
  レスポンス: { id, fields }

全関数: import { IntegrationError } from './errors'

【src/commands/airtable.ts を新規作成】
コマンド名: 'airtable'
description: 'Airtableのベース・レコードを操作します'
サブコマンド: bases / records(base_id string required, table string required, limit integer optional) / create(base_id/table string required, data string required, description: 'JSON形式のフィールドデータ')
vaultService から 'airtable_api_token' 取得。未設定ガイド color: 0xFFBF00
createサブコマンドではJSON.parse(data)でfieldsオブジェクトに変換。パース失敗時はエラーメッセージを返す。

---
=== TASK 2: Monday.com連携 ===

【src/integrations/monday.ts を新規作成】

Monday.com GraphQL API を使用。
認証: Authorization: {api_token}
Base URL: https://api.monday.com/v2

export async function getBoards(token: string): Promise<Array<{ id: string; name: string; state: string; }>>
  POST https://api.monday.com/v2
  body: { query: '{ boards(limit: 20) { id name state } }' }
  ヘッダー: { Authorization: token, 'Content-Type': 'application/json' }
  レスポンス: { data: { boards: [{ id, name, state }] } }

export async function getItems(token: string, boardId: string): Promise<Array<{ id: string; name: string; state: string; }>>
  POST https://api.monday.com/v2
  body: { query: `{ boards(ids: [${boardId}]) { items_page { items { id name state } } } }` }
  レスポンス: { data: { boards: [{ items_page: { items: [{ id, name, state }] } }] } }

export async function createItem(token: string, boardId: string, itemName: string): Promise<{ id: string; name: string; }>
  POST https://api.monday.com/v2
  body: { query: `mutation { create_item(board_id: ${boardId}, item_name: "${itemName}") { id name } }` }
  レスポンス: { data: { create_item: { id, name } } }

全関数: import { IntegrationError } from './errors'

【src/commands/monday.ts を新規作成】
コマンド名: 'monday'
description: 'Monday.comのボード・アイテムを管理します'
サブコマンド: boards / items(board_id string required) / create(board_id/item_name string required)
vaultService から 'monday_api_token' 取得。未設定ガイド color: 0xFF3D57

---
=== TASK 3: ClickUp連携 ===

【src/integrations/clickup.ts を新規作成】

ClickUp API v2 を使用。
認証: Authorization: {api_token}
Base URL: https://api.clickup.com/api/v2

export async function getSpaces(token: string, teamId: string): Promise<Array<{ id: string; name: string; }>>
  GET https://api.clickup.com/api/v2/team/{teamId}/space
  ヘッダー: { Authorization: token }
  レスポンス: { spaces: [{ id, name }] }

export async function getTasks(token: string, listId: string): Promise<Array<{ id: string; name: string; status: string; assignees: string[]; due_date: string | null; }>>
  GET https://api.clickup.com/api/v2/list/{listId}/task
  レスポンス: { tasks: [{ id, name, status: { status }, assignees: [{ username }], due_date }] }
  -> { id, name, status: status.status, assignees: assignees.map(a => a.username), due_date: due_date || null }

export async function createTask(token: string, listId: string, name: string, description?: string): Promise<{ id: string; name: string; url: string; }>
  POST https://api.clickup.com/api/v2/list/{listId}/task
  body: { name, description: description || '' }
  レスポンス: { id, name, url }

全関数: import { IntegrationError } from './errors'

【src/commands/clickup.ts を新規作成】
コマンド名: 'clickup'
description: 'ClickUpのタスク・スペースを管理します'
サブコマンド: spaces(team_id string required) / tasks(list_id string required) / create(list_id/name string required, description string optional)
vaultService から 'clickup_api_token' 取得。未設定ガイド color: 0x7B68EE

---
=== TASK 4: commandHandler.ts への登録 ===
import { airtableCommand } from '../commands/airtable';
import { mondayCommand } from '../commands/monday';
import { clickupCommand } from '../commands/clickup';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
