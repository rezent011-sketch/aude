// src/services/toolDispatcher.ts
// Function Calling ディスパッチャー — 全連携ツールをAI会話から自動呼び出し

import { searchGmailMessages, sendGmailMessage, readGmailMessage } from '../integrations/gmail';
import { listTodayCalendarEvents, addCalendarEvent } from '../integrations/google';
import { searchDriveFiles } from '../integrations/drive';
import { searchNotionPages, createNotionPage } from '../integrations/notion';
import { listRepositoryIssues, createRepositoryIssue } from '../integrations/github';
import { getFigmaFile } from '../integrations/figma';
import { listIssues as linearListIssues, createIssue as linearCreateIssue } from '../integrations/linear';
import { listIssues as jiraListIssues, createIssue as jiraCreateIssue, getJiraClient } from '../integrations/jira';
import { getBoards, getCards, createCard } from '../integrations/trello';
import { createMeeting, listMeetings } from '../integrations/zoom';
import { sendMessage as chatworkSendMessage, getRooms } from '../integrations/chatwork';
import { listIssues as backlogListIssues, createIssue as backlogCreateIssue } from '../integrations/backlog';
import { listAlerts as datadogListAlerts, getMetrics } from '../integrations/datadog';
import { listIncidents } from '../integrations/pagerduty';
import { generateImage, generateVideo, imageToVideo } from '../integrations/fal';

// ──────────────────────────────────────────────
// ツール定義 (OpenAI function_call / Anthropic tool format)
// ──────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

function isAvailable(...envKeys: string[]): boolean {
  return envKeys.every((k) => Boolean(process.env[k]?.trim()));
}

export function getAvailableTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  if (isAvailable('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN')) {
    tools.push({
      name: 'gmail_list',
      description: '受信箱のメールを取得する。最新のメール一覧を返す。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '検索クエリ（例: "from:boss@company.com", "subject:請求書"）。省略すると最新メール一覧。' },
        },
        required: [],
      },
    });
    tools.push({
      name: 'gmail_send',
      description: 'メールを送信する',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: '送信先メールアドレス' },
          subject: { type: 'string', description: 'メールの件名' },
          body: { type: 'string', description: 'メールの本文' },
        },
        required: ['to', 'subject', 'body'],
      },
    });
    tools.push({
      name: 'calendar_list',
      description: '今日のGoogleカレンダーの予定一覧を取得する',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    });
    tools.push({
      name: 'calendar_create',
      description: 'Googleカレンダーに予定を追加する',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '予定のタイトル' },
          start: { type: 'string', description: '開始日時 (ISO 8601形式、例: "2026-05-20T14:00:00+09:00")' },
          end: { type: 'string', description: '終了日時 (ISO 8601形式)' },
          description: { type: 'string', description: '予定の詳細説明（省略可）' },
        },
        required: ['summary', 'start', 'end'],
      },
    });
    tools.push({
      name: 'drive_search',
      description: 'Google Driveのファイルを検索する',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '検索クエリ（ファイル名やキーワード）' },
        },
        required: ['query'],
      },
    });
  }

  if (isAvailable('NOTION_API_KEY')) {
    tools.push({
      name: 'notion_search',
      description: 'Notionのページを検索する',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '検索キーワード' },
        },
        required: ['keyword'],
      },
    });
    tools.push({
      name: 'notion_create',
      description: 'Notionに新しいページを作成する',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'ページのタイトル' },
          content: { type: 'string', description: 'ページの内容（マークダウン形式）' },
        },
        required: ['title', 'content'],
      },
    });
  }

  if (isAvailable('GITHUB_TOKEN')) {
    tools.push({
      name: 'github_list_issues',
      description: 'GitHubリポジトリのIssue一覧を取得する',
      parameters: {
        type: 'object',
        properties: {
          repository: { type: 'string', description: 'リポジトリ名 (例: "owner/repo")' },
        },
        required: ['repository'],
      },
    });
    tools.push({
      name: 'github_create_issue',
      description: 'GitHubにIssueを作成する',
      parameters: {
        type: 'object',
        properties: {
          repository: { type: 'string', description: 'リポジトリ名 (例: "owner/repo")' },
          title: { type: 'string', description: 'Issueのタイトル' },
          body: { type: 'string', description: 'Issueの内容' },
        },
        required: ['repository', 'title'],
      },
    });
  }

  if (isAvailable('FIGMA_ACCESS_TOKEN')) {
    tools.push({
      name: 'figma_get_file',
      description: 'FigmaファイルのIDを指定してファイル情報を取得する',
      parameters: {
        type: 'object',
        properties: {
          fileKey: { type: 'string', description: 'FigmaファイルのキーID（URLの/file/以降の部分）' },
        },
        required: ['fileKey'],
      },
    });
  }

  if (isAvailable('LINEAR_API_KEY')) {
    tools.push({
      name: 'linear_list_issues',
      description: 'LinearのIssue一覧を取得する',
      parameters: {
        type: 'object',
        properties: {
          teamId: { type: 'string', description: 'チームID（省略可）' },
        },
        required: [],
      },
    });
    tools.push({
      name: 'linear_create_issue',
      description: 'LinearにIssueを作成する',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Issueのタイトル' },
          description: { type: 'string', description: 'Issueの説明（省略可）' },
          teamId: { type: 'string', description: 'チームID（必須）' },
        },
        required: ['title', 'teamId'],
      },
    });
  }

  if (isAvailable('JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN')) {
    tools.push({
      name: 'jira_list_issues',
      description: 'JiraのIssue一覧を取得する',
      parameters: {
        type: 'object',
        properties: {
          projectKey: { type: 'string', description: 'プロジェクトキー（例: "PROJ"）。省略すると全プロジェクト。' },
        },
        required: [],
      },
    });
    tools.push({
      name: 'jira_create_issue',
      description: 'JiraにIssueを作成する',
      parameters: {
        type: 'object',
        properties: {
          projectKey: { type: 'string', description: 'プロジェクトキー' },
          summary: { type: 'string', description: 'Issueのタイトル' },
          description: { type: 'string', description: 'Issueの説明（省略可）' },
          issueType: { type: 'string', description: 'IssueタイプID（省略可）' },
        },
        required: ['projectKey', 'summary'],
      },
    });
  }

  if (isAvailable('TRELLO_API_KEY', 'TRELLO_TOKEN')) {
    tools.push({
      name: 'trello_list_cards',
      description: 'TrelloボードのカードIDを一覧取得する（まずボード一覧を取得することを推奨）',
      parameters: {
        type: 'object',
        properties: {
          boardId: { type: 'string', description: 'TrelloボードのID' },
        },
        required: ['boardId'],
      },
    });
    tools.push({
      name: 'trello_create_card',
      description: 'Trelloにカードを作成する',
      parameters: {
        type: 'object',
        properties: {
          listId: { type: 'string', description: 'カードを追加するリストのID' },
          name: { type: 'string', description: 'カードのタイトル' },
          description: { type: 'string', description: 'カードの説明（省略可）' },
        },
        required: ['listId', 'name'],
      },
    });
  }

  if (isAvailable('ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_ACCOUNT_ID')) {
    tools.push({
      name: 'zoom_create_meeting',
      description: 'Zoomミーティングを作成する',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'ミーティングのタイトル' },
          startTime: { type: 'string', description: '開始日時 (ISO 8601形式、例: "2026-05-20T14:00:00Z")' },
          duration: { type: 'number', description: '所要時間（分）' },
        },
        required: ['topic'],
      },
    });
    tools.push({
      name: 'zoom_list_meetings',
      description: '予定されているZoomミーティング一覧を取得する',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    });
  }

  if (isAvailable('CHATWORK_API_TOKEN')) {
    tools.push({
      name: 'chatwork_send',
      description: 'Chatworkのルームにメッセージを送信する',
      parameters: {
        type: 'object',
        properties: {
          roomId: { type: 'string', description: 'ChatworkのルームID' },
          message: { type: 'string', description: '送信するメッセージ' },
        },
        required: ['roomId', 'message'],
      },
    });
  }

  if (isAvailable('BACKLOG_API_KEY', 'BACKLOG_SPACE')) {
    tools.push({
      name: 'backlog_list_issues',
      description: 'Backlogの課題一覧を取得する',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'number', description: 'プロジェクトID（省略可）' },
        },
        required: [],
      },
    });
    tools.push({
      name: 'backlog_create_issue',
      description: 'Backlogに課題を作成する',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'number', description: 'プロジェクトID（数値）' },
          summary: { type: 'string', description: '課題のタイトル' },
          issueTypeId: { type: 'number', description: '課題タイプID（数値）' },
          description: { type: 'string', description: '課題の説明（省略可）' },
        },
        required: ['projectId', 'summary', 'issueTypeId'],
      },
    });
  }

  if (isAvailable('DATADOG_API_KEY', 'DATADOG_APP_KEY')) {
    tools.push({
      name: 'datadog_list_monitors',
      description: 'Datadogのモニター（アラート）一覧を取得する',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    });
  }

  if (isAvailable('PAGERDUTY_TOKEN')) {
    tools.push({
      name: 'pagerduty_list_incidents',
      description: 'PagerDutyのインシデント一覧を取得する',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'インシデントのステータスフィルター', enum: ['triggered', 'acknowledged', 'resolved'] },
        },
        required: [],
      },
    });
  }

  if (isAvailable('FAL_KEY')) {
    tools.push({
      name: 'generate_image',
      description: '画像をAIで生成する。ランディングページ用ビジュアル、バナー、アイコン、イラストなど。ユーザーが「画像を作って」「イメージを生成して」「絵を描いて」と言ったら使う。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '生成したい画像の詳細な説明（英語推奨）' },
          aspect_ratio: { type: 'string', description: 'アスペクト比', enum: ['1:1', '16:9', '9:16', '4:3'] },
        },
        required: ['prompt'],
      },
    });
    tools.push({
      name: 'generate_video',
      description: '動画をAIで生成する。宣伝動画、プロモーション映像、SNS用動画など。ユーザーが「動画を作って」「映像を生成して」と言ったら使う。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '生成したい動画の詳細な説明（英語推奨）' },
          duration: { type: 'number', description: '動画の長さ（秒）: 5 または 10', enum: ['5', '10'] },
          aspect_ratio: { type: 'string', description: 'アスペクト比', enum: ['16:9', '9:16', '1:1'] },
          image_url: { type: 'string', description: 'この画像URLを動画に変換する場合に指定（省略可）' },
        },
        required: ['prompt'],
      },
    });
  }

  return tools;
}

// ──────────────────────────────────────────────
// ツール実行
// ──────────────────────────────────────────────

function truncate(text: string, max = 1500): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n…（省略）';
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      // ── Gmail ──
      case 'gmail_list': {
        const query = (args.query as string | undefined) ?? '';
        const messages = await searchGmailMessages(query);
        if (messages.length === 0) return 'メールが見つかりませんでした。';
        const lines = messages.slice(0, 10).map(
          (m, i) => `${i + 1}. **${m.subject}**\n   差出人: ${m.from}\n   日時: ${m.date}`
        );
        return `📬 メール一覧 (${messages.length}件):\n\n${lines.join('\n\n')}`;
      }
      case 'gmail_send': {
        const result = await sendGmailMessage(
          args.to as string,
          args.subject as string,
          args.body as string
        );
        return `✅ メールを送信しました\n宛先: ${args.to}\n件名: ${args.subject}\nID: ${result.id}`;
      }

      // ── Calendar ──
      case 'calendar_list': {
        const events = await listTodayCalendarEvents();
        if (events.length === 0) return '今日の予定はありません。';
        const lines = events.map(
          (e) => `• **${e.title}**\n  ${e.start} 〜 ${e.end}${e.url ? '\n  🔗 ' + e.url : ''}`
        );
        return `📅 今日の予定 (${events.length}件):\n\n${lines.join('\n\n')}`;
      }
      case 'calendar_create': {
        const event = await addCalendarEvent(
          args.summary as string,
          args.start as string
        );
        return `✅ 予定を追加しました\n**${event.title}**\n${event.start} 〜 ${event.end}${event.url ? '\n🔗 ' + event.url : ''}`;
      }

      // ── Drive ──
      case 'drive_search': {
        const files = await searchDriveFiles(args.query as string);
        if (files.length === 0) return 'ファイルが見つかりませんでした。';
        const lines = files.slice(0, 10).map(
          (f) => `• **${f.name}** (${f.mimeType})\n  🔗 ${f.url ?? '（リンクなし）'}`
        );
        return `📁 Drive検索結果 (${files.length}件):\n\n${lines.join('\n\n')}`;
      }

      // ── Notion ──
      case 'notion_search': {
        const pages = await searchNotionPages(args.keyword as string);
        if (pages.length === 0) return 'Notionページが見つかりませんでした。';
        const lines = pages.slice(0, 10).map(
          (p) => `• **${p.title}**\n  🔗 ${p.url}`
        );
        return `📝 Notion検索結果 (${pages.length}件):\n\n${lines.join('\n\n')}`;
      }
      case 'notion_create': {
        const page = await createNotionPage(args.title as string, args.content as string);
        return `✅ Notionページを作成しました\n🔗 ${page.url}`;
      }

      // ── GitHub ──
      case 'github_list_issues': {
        const issues = await listRepositoryIssues(args.repository as string);
        if (issues.length === 0) return 'Issueが見つかりませんでした。';
        const lines = issues.slice(0, 10).map(
          (i) => `• **#${i.number} ${i.title}** [${i.state}]\n  🔗 ${i.url}`
        );
        return `🐙 GitHub Issues (${issues.length}件):\n\n${lines.join('\n\n')}`;
      }
      case 'github_create_issue': {
        const issue = await createRepositoryIssue(
          args.repository as string,
          args.title as string,
          (args.body as string | undefined) ?? ''
        );
        return `✅ GitHubにIssueを作成しました\n**#${issue.number} ${issue.title}**\n🔗 ${issue.url}`;
      }

      // ── Figma ──
      case 'figma_get_file': {
        const file = await getFigmaFile(args.fileKey as string);
        return `🎨 Figmaファイル:\n**${file.name}**\n最終更新: ${file.lastModified ?? '不明'}`;
      }

      // ── Linear ──
      case 'linear_list_issues': {
        const apiKey = process.env.LINEAR_API_KEY!;
        const issues = await linearListIssues(apiKey, args.teamId as string | undefined);
        if (issues.length === 0) return 'Issueが見つかりませんでした。';
        const lines = issues.slice(0, 10).map(
          (i) => `• **${i.id} ${i.title}** [${i.state}]\n  🔗 ${i.url}`
        );
        return `📋 Linear Issues (${issues.length}件):\n\n${lines.join('\n\n')}`;
      }
      case 'linear_create_issue': {
        const apiKey = process.env.LINEAR_API_KEY!;
        const issue = await linearCreateIssue(apiKey, {
          title: args.title as string,
          description: args.description as string | undefined,
          teamId: args.teamId as string,
        });
        return `✅ LinearにIssueを作成しました\n**${issue.id} ${issue.title}**\n🔗 ${issue.url}`;
      }

      // ── Jira ──
      case 'jira_list_issues': {
        const client = getJiraClient(
          process.env.JIRA_HOST!,
          process.env.JIRA_EMAIL!,
          process.env.JIRA_API_TOKEN!
        );
        const issues = await jiraListIssues(client, args.projectKey as string | undefined);
        if (issues.length === 0) return 'Issueが見つかりませんでした。';
        const lines = issues.slice(0, 10).map(
          (i) => `• **${i.key} ${i.summary}** [${i.status}]\n  🔗 ${i.url}`
        );
        return `📌 Jira Issues (${issues.length}件):\n\n${lines.join('\n\n')}`;
      }
      case 'jira_create_issue': {
        const client = getJiraClient(
          process.env.JIRA_HOST!,
          process.env.JIRA_EMAIL!,
          process.env.JIRA_API_TOKEN!
        );
        const issue = await jiraCreateIssue(client, process.env.JIRA_HOST!, {
          projectKey: args.projectKey as string,
          summary: args.summary as string,
          description: args.description as string | undefined,
          issueType: args.issueType as string | undefined,
        });
        return `✅ JiraにIssueを作成しました\n**${issue.key}**\n🔗 ${issue.url}`;
      }

      // ── Trello ──
      case 'trello_list_cards': {
        const apiKey = process.env.TRELLO_API_KEY!;
        const token = process.env.TRELLO_TOKEN!;
        const cards = await getCards(apiKey, token, args.boardId as string);
        if (cards.length === 0) return 'カードが見つかりませんでした。';
        const lines = cards.slice(0, 10).map(
          (c) => `• **${c.name}**\n  🔗 ${c.url}`
        );
        return `📋 Trello Cards (${cards.length}件):\n\n${lines.join('\n\n')}`;
      }
      case 'trello_create_card': {
        const apiKey = process.env.TRELLO_API_KEY!;
        const token = process.env.TRELLO_TOKEN!;
        const card = await createCard(apiKey, token, {
          idList: args.listId as string,
          name: args.name as string,
          desc: args.description as string | undefined,
        });
        return `✅ Trelloカードを作成しました\n**${card.name}**\n🔗 ${card.url}`;
      }

      // ── Zoom ──
      case 'zoom_create_meeting': {
        const token = await (await import('../integrations/zoom')).getAccessToken(
          process.env.ZOOM_ACCOUNT_ID!,
          process.env.ZOOM_CLIENT_ID!,
          process.env.ZOOM_CLIENT_SECRET!
        );
        const meeting = await createMeeting(token, 'me', {
          topic: args.topic as string,
          start_time: args.startTime as string | undefined,
          duration: args.duration as number | undefined,
        });
        return `✅ Zoomミーティングを作成しました\n**${meeting.topic}**\n開始: ${meeting.start_time}\n🔗 ${meeting.join_url}`;
      }
      case 'zoom_list_meetings': {
        const token = await (await import('../integrations/zoom')).getAccessToken(
          process.env.ZOOM_ACCOUNT_ID!,
          process.env.ZOOM_CLIENT_ID!,
          process.env.ZOOM_CLIENT_SECRET!
        );
        const meetings = await listMeetings(token, 'me');
        if (meetings.length === 0) return '予定されているZoomミーティングはありません。';
        const lines = meetings.slice(0, 10).map(
          (m) => `• **${m.topic}**\n  開始: ${m.start_time}\n  🔗 ${m.join_url}`
        );
        return `📹 Zoom Meetings (${meetings.length}件):\n\n${lines.join('\n\n')}`;
      }

      // ── Chatwork ──
      case 'chatwork_send': {
        await chatworkSendMessage(
          process.env.CHATWORK_API_TOKEN!,
          Number(args.roomId),
          args.message as string
        );
        return `✅ Chatworkにメッセージを送信しました\nルームID: ${args.roomId}`;
      }

      // ── Backlog ──
      case 'backlog_list_issues': {
        const issues = await backlogListIssues(
          process.env.BACKLOG_API_KEY!,
          process.env.BACKLOG_SPACE!,
          args.projectId as number | undefined
        );
        if (issues.length === 0) return '課題が見つかりませんでした。';
        const lines = issues.slice(0, 10).map(
          (i) => `• **${i.issueKey} ${i.summary}** [${i.status}]\n  🔗 ${i.url}`
        );
        return `📋 Backlog Issues (${issues.length}件):\n\n${lines.join('\n\n')}`;
      }
      case 'backlog_create_issue': {
        const issue = await backlogCreateIssue(
          process.env.BACKLOG_API_KEY!,
          process.env.BACKLOG_SPACE!,
          {
            projectId: args.projectId as number,
            summary: args.summary as string,
            issueTypeId: args.issueTypeId as number,
            description: args.description as string | undefined,
          }
        );
        return `✅ Backlogに課題を作成しました\n**${issue.issueKey}**\n🔗 ${issue.url}`;
      }

      // ── Datadog ──
      case 'datadog_list_monitors': {
        const monitors = await datadogListAlerts(
          process.env.DATADOG_API_KEY!,
          process.env.DATADOG_APP_KEY!
        );
        if (monitors.length === 0) return 'モニターが見つかりませんでした。';
        const lines = monitors.slice(0, 10).map(
          (m) => `• **${m.name}** [${m.status}]`
        );
        return `🔍 Datadog Monitors (${monitors.length}件):\n\n${lines.join('\n')}`;
      }

      // ── PagerDuty ──
      case 'pagerduty_list_incidents': {
        const statusArg = args.status as string | undefined;
        const statuses = statusArg ? [statusArg] : undefined;
        const incidents = await listIncidents(
          process.env.PAGERDUTY_TOKEN!,
          statuses
        );
        if (incidents.length === 0) return 'インシデントが見つかりませんでした。';
        const lines = incidents.slice(0, 10).map(
          (i) => `• **${i.title}** [${i.status}]\n  🔗 ${i.html_url}`
        );
        return `🚨 PagerDuty Incidents (${incidents.length}件):\n\n${lines.join('\n\n')}`;
      }

      // ── fal.ai ──
      case 'generate_image': {
        const imgResult = await generateImage(
          args.prompt as string,
          (args.aspect_ratio as '1:1' | '16:9' | '9:16' | '4:3') ?? '1:1'
        );
        return `🎨 **画像を生成しました！**\n🔗 ${imgResult.url}\n\n> DiscordのDMや直接URLを開いて確認してください。\n> サイズ: ${imgResult.width}×${imgResult.height}`;
      }
      case 'generate_video': {
        const isImg2Vid = Boolean(args.image_url);
        const vidResult = isImg2Vid
          ? await imageToVideo(
              args.image_url as string,
              args.prompt as string,
              (args.duration as 5 | 10) ?? 5
            )
          : await generateVideo(
              args.prompt as string,
              (args.duration as 5 | 10) ?? 5,
              (args.aspect_ratio as '16:9' | '9:16' | '1:1') ?? '16:9'
            );
        return `🎬 **動画を生成しました！**\n🔗 ${vidResult.url}\n\n> URLをブラウザで開くか、ダウンロードしてください。\n> 長さ: ${vidResult.duration}秒`;
      }

      default:
        return `ツール "${toolName}" は未実装です。`;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `⚠️ ${toolName} の実行に失敗しました: ${msg}`;
  }
}

// OpenAI tools形式に変換
export function toOpenAITools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Anthropic tools形式に変換
export function toAnthropicTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}
