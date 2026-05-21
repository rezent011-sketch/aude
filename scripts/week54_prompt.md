=== Week54: Microsoft Teams・Outlook・OneDrive連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: Microsoft Teams連携 ===

【src/integrations/teams.ts を新規作成】

Microsoft Graph API を使用。
認証: Bearer token (Azure AD OAuth2)
Base URL: https://graph.microsoft.com/v1.0

export async function getTeams(token: string): Promise<Array<{ id: string; displayName: string; description: string; }>>
  GET https://graph.microsoft.com/v1.0/me/joinedTeams
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { value: [{ id, displayName, description }] }

export async function getChannels(token: string, teamId: string): Promise<Array<{ id: string; displayName: string; membershipType: string; }>>
  GET https://graph.microsoft.com/v1.0/teams/{teamId}/channels
  レスポンス: { value: [{ id, displayName, membershipType }] }

export async function sendMessage(token: string, teamId: string, channelId: string, content: string): Promise<void>
  POST https://graph.microsoft.com/v1.0/teams/{teamId}/channels/{channelId}/messages
  body: { body: { contentType: 'text', content } }

全関数: import { IntegrationError } from './errors'

【src/commands/teams.ts を新規作成】
コマンド名: 'teams'
description: 'Microsoft Teamsのチーム・チャンネル・メッセージを操作します'
サブコマンド: list(チーム一覧) / channels(team_id string required) / send(team_id/channel_id/message string required)
vaultService から 'teams_access_token' 取得。未設定ガイド color: 0x6264A7

---
=== TASK 2: Outlook連携 ===

【src/integrations/outlook.ts を新規作成】

Microsoft Graph API を使用。
認証: Bearer token
Base URL: https://graph.microsoft.com/v1.0/me

export async function getEmails(token: string, top?: number): Promise<Array<{ id: string; subject: string; from: string; receivedDateTime: string; isRead: boolean; }>>
  GET https://graph.microsoft.com/v1.0/me/messages?$top={top||10}&$orderby=receivedDateTime desc
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { value: [{ id, subject, from: { emailAddress: { address } }, receivedDateTime, isRead }] }
  -> { id, subject, from: from.emailAddress.address, receivedDateTime, isRead }

export async function sendEmail(token: string, to: string, subject: string, body: string): Promise<void>
  POST https://graph.microsoft.com/v1.0/me/sendMail
  body: { message: { subject, body: { contentType: 'Text', content: body }, toRecipients: [{ emailAddress: { address: to } }] } }

export async function getCalendarEvents(token: string): Promise<Array<{ id: string; subject: string; start: string; end: string; location: string; }>>
  GET https://graph.microsoft.com/v1.0/me/calendar/events?$top=10
  レスポンス: { value: [{ id, subject, start: { dateTime }, end: { dateTime }, location: { displayName } }] }
  -> { id, subject, start: start.dateTime, end: end.dateTime, location: location.displayName }

全関数: import { IntegrationError } from './errors'

【src/commands/outlook.ts を新規作成】
コマンド名: 'outlook'
description: 'Outlookのメール・カレンダーを操作します'
サブコマンド: emails(top integer optional) / send(to/subject/body string required) / events(予定一覧)
vaultService から 'outlook_access_token' 取得。未設定ガイド color: 0x0078D4

---
=== TASK 3: OneDrive連携 ===

【src/integrations/onedrive.ts を新規作成】

Microsoft Graph API を使用。
認証: Bearer token
Base URL: https://graph.microsoft.com/v1.0/me/drive

export async function listFiles(token: string, folderId?: string): Promise<Array<{ id: string; name: string; size: number; lastModifiedDateTime: string; webUrl: string; isFolder: boolean; }>>
  GET https://graph.microsoft.com/v1.0/me/drive/{folderId ? 'items/'+folderId : 'root'}/children
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { value: [{ id, name, size, lastModifiedDateTime, webUrl, folder }] }
  -> { id, name, size: size||0, lastModifiedDateTime, webUrl, isFolder: !!folder }

export async function searchFiles(token: string, query: string): Promise<Array<{ id: string; name: string; webUrl: string; }>>
  GET https://graph.microsoft.com/v1.0/me/drive/root/search(q='{query}')
  レスポンス: { value: [{ id, name, webUrl }] }

全関数: import { IntegrationError } from './errors'

【src/commands/onedrive.ts を新規作成】
コマンド名: 'onedrive'
description: 'OneDriveのファイルを管理します'
サブコマンド: files(folder_id string optional) / search(query string required)
vaultService から 'onedrive_access_token' 取得。未設定ガイド color: 0x0078D4

---
=== TASK 4: commandHandler.ts への登録 ===
import { teamsCommand } from '../commands/teams';
import { outlookCommand } from '../commands/outlook';
import { onedriveCommand } from '../commands/onedrive';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
