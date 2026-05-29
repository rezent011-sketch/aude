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
import { sendDiscordMessage } from './discordClient';

// ── 追加import (Week65: 全ツール自然言語対応) ──
import { sendMessage as slackSendMessage, getChannels as slackGetChannels } from '../integrations/slack';
import { getAccounts as sfGetAccounts, getOpportunities as sfGetOpportunities, createLead as sfCreateLead } from '../integrations/salesforce';
import { getContacts as hubspotGetContacts, getDeals as hubspotGetDeals, createContact as hubspotCreateContact } from '../integrations/hubspotcrm';
import { getRecords as kintoneGetRecords, createRecord as kintoneCreateRecord, getApps as kintoneGetApps } from '../integrations/kintone';
import { listDeals as freeeListDeals, createDeal as freeeCreateDeal, listPartners as freeeListPartners } from '../integrations/freee';
import { getEmployees as smarthrGetEmployees, getDepartments as smarthrGetDepartments } from '../integrations/smarthr';
import { sendEmail as sendgridSendEmail, getStats as sendgridGetStats } from '../integrations/sendgrid';
import { sendSms as twilioSendSms, getMessages as twilioGetMessages } from '../integrations/twilio';
import { getOrders as shopifyGetOrders, getProducts as shopifyGetProducts } from '../integrations/shopify';
import { listCustomers as stripeListCustomers, listPayments as stripeListPayments, createPaymentLink as stripeCreatePaymentLink } from '../integrations/stripeapi';
import { listSubscriptions as stripeListSubscriptions, listInvoices as stripeListInvoices } from '../integrations/stripebilling';
import { getTickets as zendeskGetTickets, createTicket as zendeskCreateTicket } from '../integrations/zendesk';
import { getConversations as intercomGetConversations, sendMessage as intercomSendMessage } from '../integrations/intercom';
import { getIssues as sentryGetIssues, getProjects as sentryGetProjects } from '../integrations/sentry';
import { getTasks as asanaGetTasks, createTask as asanaCreateTask } from '../integrations/asana';
import { getTasks as clickupGetTasks, createTask as clickupCreateTask } from '../integrations/clickup';
import { getBoards as mondayGetBoards, getItems as mondayGetItems, createItem as mondayCreateItem } from '../integrations/monday';
import { searchPages as confluenceSearchPages, createPage as confluenceCreatePage } from '../integrations/confluence';
import { getBoards as miroGetBoards, createStickyNote as miroCreateStickyNote } from '../integrations/miro';
import { listFolder as dropboxListFolder, search as dropboxSearch } from '../integrations/dropbox';
import { listFiles as boxListFiles, searchFiles as boxSearchFiles } from '../integrations/box';
import { listFiles as onedriveListFiles, searchFiles as onedriveSearchFiles } from '../integrations/onedrive';
import { getTeams, getChannels as teamsGetChannels, sendMessage as teamsSendMessage } from '../integrations/teams';
import { getEmails as outlookGetEmails, sendEmail as outlookSendEmail, getCalendarEvents as outlookGetCalendarEvents } from '../integrations/outlook';
import { getActiveUsers as amplitudeGetActiveUsers, getEventCounts as amplitudeGetEventCounts } from '../integrations/amplitude';
import { getTopEvents as mixpanelGetTopEvents } from '../integrations/mixpanel';
import { getPageViews as gaGetPageViews, getActiveUsers as gaGetActiveUsers } from '../integrations/googleanalytics';
import { listWorkflows as ghActionsListWorkflows, listRuns as ghActionsListRuns, triggerWorkflow as ghActionsTriggerWorkflow } from '../integrations/githubactions';
import { listProjects as gitlabListProjects, listMergeRequests as gitlabListMRs, createMergeRequest as gitlabCreateMR } from '../integrations/gitlab';
import { getPipelines as circleciGetPipelines, triggerPipeline as circleciTriggerPipeline } from '../integrations/circleci';
import { getApps as herokuGetApps, restartDynos as herokuRestartDynos } from '../integrations/heroku';
import { getLists as mailchimpGetLists, getCampaigns as mailchimpGetCampaigns } from '../integrations/mailchimp';
import { getContacts as brevoGetContacts, sendTransactionalEmail as brevoSendEmail } from '../integrations/brevo';
import { getContacts as acGetContacts, createContact as acCreateContact } from '../integrations/activecampaign';
import { getForms as typeformGetForms, getResponses as typeformGetResponses } from '../integrations/typeform';
import { getSurveys as surveymonkeyGetSurveys } from '../integrations/surveymonkey';
import { getDeals as pipedriveGetDeals, getPersons as pipedriveGetPersons, createDeal as pipedriveCreateDeal } from '../integrations/pipedrive';
import { searchPeople as copperSearchPeople, getOpportunities as copperGetOpportunities } from '../integrations/copper';
import { getContacts as sansanGetContacts } from '../integrations/sansan';
import { listBases as airtableListBases, listRecords as airtableListRecords, createRecord as airtableCreateRecord } from '../integrations/airtable';
import { listDocs as codaListDocs, listRows as codaListRows } from '../integrations/coda';
import { pushMessage as linePushMessage, broadcastMessage as lineBroadcastMessage } from '../integrations/line';
import { getChannels as lineworksGetChannels, sendMessage as lineworksSendMessage } from '../integrations/lineworks';
import { getStaffList as jobcanGetStaff, getAttendance as jobcanGetAttendance, clockIn as jobcanClockIn, clockOut as jobcanClockOut } from '../integrations/jobcan';
import { getEmployees as mfGetEmployees, getPayslips as mfGetPayslips } from '../integrations/mfpayroll';
import { getInvoices as moneyforwardGetInvoices, getExpenses as moneyforwardGetExpenses } from '../integrations/moneyforward';
import { getTrialBalance as yayoiGetTrialBalance, getJournalEntries as yayoiGetJournalEntries } from '../integrations/yayoi';
import { getFlags as ldGetFlags, toggleFlag as ldToggleFlag } from '../integrations/launchdarkly';
import { getPages as statuspageGetPages, getIncidents as statuspageGetIncidents, createIncident as statuspageCreateIncident } from '../integrations/statuspage';
import { getAlarms as cwGetAlarms } from '../integrations/cloudwatch';
import { listLocations as squareListLocations, listTransactions as squareListTransactions } from '../integrations/square';
import { getDocuments as cloudsignGetDocuments, createDocument as cloudsignCreateDocument } from '../integrations/cloudsign';
import { getDocuments as gmoagreeGetDocuments } from '../integrations/gmoagree';
import { getEnvelopes as docusignGetEnvelopes } from '../integrations/docusign';
import { getContracts as freesignGetContracts } from '../integrations/freeesign';
import { getEmployees as freeehrGetEmployees, getPayrolls as freeehrGetPayrolls } from '../integrations/freeehr';
import { getVisitors as receptionistGetVisitors } from '../integrations/receptionist';
import { getJobs as talentioGetJobs, getCandidates as talentioGetCandidates } from '../integrations/talentio';
import { getCalendarEvents as rakumoGetCalendar, getContacts as rakumoGetContacts } from '../integrations/rakumo';
import { getJobPostings as wantedlyGetJobPostings, getApplicants as wantedlyGetApplicants } from '../integrations/wantedly';
import { getMyTasks as asanataskGetMyTasks, createTask as asanataskCreateTask } from '../integrations/asanatasks';
import { getSchedules as cybozuGetSchedules, createSchedule as cybozuCreateSchedule } from '../integrations/cybozu';
import { getEventTypes as calendlyGetEventTypes, getScheduledEvents as calendlyGetScheduledEvents } from '../integrations/calendly';
import { getSites as webflowGetSites, publishSite as webflowPublishSite } from '../integrations/webflow';
import { getWorkflows as n8nGetWorkflows, triggerWorkflow as n8nTriggerWorkflow } from '../integrations/n8n';
import { triggerZap as zapierTriggerZap } from '../integrations/zapier';
import { getScenarios as makeGetScenarios, triggerScenario as makeTriggerScenario } from '../integrations/make';
import { getCampaigns as tiktokGetCampaigns } from '../integrations/tiktokads';
import { getCampaigns as metaGetCampaigns, getCampaignInsights as metaGetInsights } from '../integrations/metaads';
import { sendSms as vonageSendSms } from '../integrations/vonage';
import { listBuckets as s3ListBuckets, listObjects as s3ListObjects } from '../integrations/awss3';
import { getZones as cfGetZones, getDnsRecords as cfGetDns, purgeCache as cfPurgeCache } from '../integrations/cloudflare';
import { sendEmail as postmarkSendEmail, getStats as postmarkGetStats } from '../integrations/postmark';
import { listModels as openaiListModels } from '../integrations/openaiapi';
import { executeExtendedToolCall } from './toolDispatcherExtended';

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
          channel_id: { type: 'string', description: '完了通知を送るDiscordチャンネルID' },
        },
        required: ['prompt'],
      },
    });
  }

  // ── Week65追加: 全75ツール Function Calling定義 ──

  if (isAvailable('SLACK_BOT_TOKEN')) {
    tools.push({ name: 'slack_send', description: 'Slackのチャンネルにメッセージを送信する。「Slackに送って」「Slackで通知して」と言ったら使う。', parameters: { type: 'object', properties: { channel: { type: 'string', description: 'チャンネル名またはID (例: #general)' }, message: { type: 'string', description: '送信するメッセージ' } }, required: ['channel', 'message'] } });
    tools.push({ name: 'slack_list_channels', description: 'Slackのチャンネル一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
  }

  if (isAvailable('SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET', 'SALESFORCE_REFRESH_TOKEN', 'SALESFORCE_INSTANCE_URL')) {
    tools.push({ name: 'salesforce_list_accounts', description: 'Salesforceの取引先（アカウント）一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可、デフォルト10）' } }, required: [] } });
    tools.push({ name: 'salesforce_list_opportunities', description: 'Salesforceの商談一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
    tools.push({ name: 'salesforce_create_lead', description: 'Salesforceにリードを作成する', parameters: { type: 'object', properties: { firstName: { type: 'string', description: '名' }, lastName: { type: 'string', description: '姓' }, company: { type: 'string', description: '会社名' }, email: { type: 'string', description: 'メールアドレス（省略可）' } }, required: ['lastName', 'company'] } });
  }

  if (isAvailable('HUBSPOT_ACCESS_TOKEN')) {
    tools.push({ name: 'hubspot_list_contacts', description: 'HubSpotのコンタクト一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
    tools.push({ name: 'hubspot_list_deals', description: 'HubSpotの取引（ディール）一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
    tools.push({ name: 'hubspot_create_contact', description: 'HubSpotにコンタクトを作成する', parameters: { type: 'object', properties: { email: { type: 'string', description: 'メールアドレス' }, firstName: { type: 'string', description: '名（省略可）' }, lastName: { type: 'string', description: '姓（省略可）' } }, required: ['email'] } });
  }

  if (isAvailable('KINTONE_SUBDOMAIN', 'KINTONE_API_TOKEN')) {
    tools.push({ name: 'kintone_get_apps', description: 'kintoneのアプリ一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'kintone_get_records', description: 'kintoneアプリのレコード一覧を取得する', parameters: { type: 'object', properties: { appId: { type: 'string', description: 'アプリID' }, query: { type: 'string', description: '検索クエリ（省略可）' } }, required: ['appId'] } });
    tools.push({ name: 'kintone_create_record', description: 'kintoneにレコードを作成する', parameters: { type: 'object', properties: { appId: { type: 'string', description: 'アプリID' }, fields: { type: 'string', description: 'フィールドのJSON文字列（例: {"タイトル":{"value":"テスト"}}）' } }, required: ['appId', 'fields'] } });
  }

  if (isAvailable('FREEE_CLIENT_ID', 'FREEE_CLIENT_SECRET', 'FREEE_REFRESH_TOKEN')) {
    tools.push({ name: 'freee_list_deals', description: 'freeeの取引一覧を取得する', parameters: { type: 'object', properties: { companyId: { type: 'number', description: '事業所ID' } }, required: ['companyId'] } });
    tools.push({ name: 'freee_list_partners', description: 'freeeの取引先一覧を取得する', parameters: { type: 'object', properties: { companyId: { type: 'number', description: '事業所ID' } }, required: ['companyId'] } });
  }

  if (isAvailable('SMARTHR_CLIENT_ID', 'SMARTHR_CLIENT_SECRET', 'SMARTHR_SUBDOMAIN')) {
    tools.push({ name: 'smarthr_list_employees', description: 'SmartHRの従業員一覧を取得する', parameters: { type: 'object', properties: { page: { type: 'number', description: 'ページ番号（省略可）' } }, required: [] } });
    tools.push({ name: 'smarthr_list_departments', description: 'SmartHRの部署一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
  }

  if (isAvailable('SENDGRID_API_KEY')) {
    tools.push({ name: 'sendgrid_send', description: 'SendGridでメールを送信する', parameters: { type: 'object', properties: { to: { type: 'string', description: '送信先メールアドレス' }, subject: { type: 'string', description: '件名' }, body: { type: 'string', description: '本文（HTML可）' }, from: { type: 'string', description: '送信元アドレス（省略時はデフォルト）' } }, required: ['to', 'subject', 'body'] } });
  }

  if (isAvailable('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER')) {
    tools.push({ name: 'twilio_send_sms', description: 'TwilioでSMSを送信する', parameters: { type: 'object', properties: { to: { type: 'string', description: '送信先電話番号 (E.164形式: +81901234567)' }, message: { type: 'string', description: '送信するメッセージ' } }, required: ['to', 'message'] } });
    tools.push({ name: 'twilio_list_messages', description: 'Twilioのメッセージ履歴を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
  }

  if (isAvailable('SHOPIFY_SHOP', 'SHOPIFY_ACCESS_TOKEN')) {
    tools.push({ name: 'shopify_list_orders', description: 'Shopifyの注文一覧を取得する', parameters: { type: 'object', properties: { status: { type: 'string', description: '注文ステータス (open/closed/cancelled/any)', enum: ['open', 'closed', 'cancelled', 'any'] } }, required: [] } });
    tools.push({ name: 'shopify_list_products', description: 'Shopifyの商品一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
  }

  if (isAvailable('STRIPE_SECRET_KEY')) {
    tools.push({ name: 'stripe_list_customers', description: 'Stripeの顧客一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
    tools.push({ name: 'stripe_list_payments', description: 'Stripeの支払い一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
    tools.push({ name: 'stripe_list_subscriptions', description: 'Stripeのサブスクリプション一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
  }

  if (isAvailable('ZENDESK_SUBDOMAIN', 'ZENDESK_EMAIL', 'ZENDESK_API_TOKEN')) {
    tools.push({ name: 'zendesk_list_tickets', description: 'Zendeskのチケット一覧を取得する', parameters: { type: 'object', properties: { status: { type: 'string', description: 'ステータス (open/pending/solved/closed)', enum: ['open', 'pending', 'solved', 'closed'] } }, required: [] } });
    tools.push({ name: 'zendesk_create_ticket', description: 'Zendeskにチケットを作成する', parameters: { type: 'object', properties: { subject: { type: 'string', description: 'チケットの件名' }, description: { type: 'string', description: 'チケットの内容' }, priority: { type: 'string', description: '優先度 (low/normal/high/urgent)', enum: ['low', 'normal', 'high', 'urgent'] } }, required: ['subject', 'description'] } });
  }

  if (isAvailable('INTERCOM_ACCESS_TOKEN')) {
    tools.push({ name: 'intercom_list_conversations', description: 'Intercomの会話一覧を取得する', parameters: { type: 'object', properties: { status: { type: 'string', description: 'ステータス (open/closed)', enum: ['open', 'closed'] } }, required: [] } });
  }

  if (isAvailable('SENTRY_AUTH_TOKEN', 'SENTRY_ORG_SLUG')) {
    tools.push({ name: 'sentry_list_issues', description: 'Sentryのエラー一覧を取得する', parameters: { type: 'object', properties: { projectSlug: { type: 'string', description: 'プロジェクトスラッグ（省略可）' }, query: { type: 'string', description: '検索クエリ（省略可）' } }, required: [] } });
  }

  if (isAvailable('ASANA_PAT')) {
    tools.push({ name: 'asana_list_tasks', description: 'Asanaのタスク一覧を取得する', parameters: { type: 'object', properties: { projectId: { type: 'string', description: 'プロジェクトID（省略可）' } }, required: [] } });
    tools.push({ name: 'asana_create_task', description: 'Asanaにタスクを作成する', parameters: { type: 'object', properties: { name: { type: 'string', description: 'タスク名' }, projectId: { type: 'string', description: 'プロジェクトID（省略可）' }, notes: { type: 'string', description: 'タスクの詳細（省略可）' }, dueOn: { type: 'string', description: '期限日 (YYYY-MM-DD形式、省略可)' } }, required: ['name'] } });
  }

  if (isAvailable('CLICKUP_API_TOKEN')) {
    tools.push({ name: 'clickup_list_tasks', description: 'ClickUpのタスク一覧を取得する', parameters: { type: 'object', properties: { listId: { type: 'string', description: 'リストID（省略可）' } }, required: [] } });
    tools.push({ name: 'clickup_create_task', description: 'ClickUpにタスクを作成する', parameters: { type: 'object', properties: { listId: { type: 'string', description: 'リストID' }, name: { type: 'string', description: 'タスク名' }, description: { type: 'string', description: 'タスクの説明（省略可）' } }, required: ['listId', 'name'] } });
  }

  if (isAvailable('MONDAY_API_KEY')) {
    tools.push({ name: 'monday_list_boards', description: 'monday.comのボード一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'monday_create_item', description: 'monday.comにアイテムを作成する', parameters: { type: 'object', properties: { boardId: { type: 'string', description: 'ボードID' }, itemName: { type: 'string', description: 'アイテム名' } }, required: ['boardId', 'itemName'] } });
  }

  if (isAvailable('CONFLUENCE_HOST', 'CONFLUENCE_EMAIL', 'CONFLUENCE_API_TOKEN')) {
    tools.push({ name: 'confluence_search', description: 'Confluenceのページを検索する', parameters: { type: 'object', properties: { query: { type: 'string', description: '検索キーワード' } }, required: ['query'] } });
    tools.push({ name: 'confluence_create_page', description: 'Confluenceにページを作成する', parameters: { type: 'object', properties: { title: { type: 'string', description: 'ページタイトル' }, content: { type: 'string', description: 'ページ内容（Markdown）' }, spaceKey: { type: 'string', description: 'スペースキー' } }, required: ['title', 'content', 'spaceKey'] } });
  }

  if (isAvailable('MIRO_ACCESS_TOKEN')) {
    tools.push({ name: 'miro_list_boards', description: 'Miroのボード一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'miro_create_sticky', description: 'Miroにスティッキーノートを作成する', parameters: { type: 'object', properties: { boardId: { type: 'string', description: 'ボードID' }, content: { type: 'string', description: 'ノートの内容' }, color: { type: 'string', description: '色 (yellow/blue/green/pink/purple/red)', enum: ['yellow', 'blue', 'green', 'pink', 'purple', 'red'] } }, required: ['boardId', 'content'] } });
  }

  if (isAvailable('DROPBOX_ACCESS_TOKEN')) {
    tools.push({ name: 'dropbox_list_files', description: 'Dropboxのファイル一覧を取得する', parameters: { type: 'object', properties: { path: { type: 'string', description: 'フォルダパス（省略時はルート）' } }, required: [] } });
    tools.push({ name: 'dropbox_search', description: 'Dropboxのファイルを検索する', parameters: { type: 'object', properties: { query: { type: 'string', description: '検索クエリ' } }, required: ['query'] } });
  }

  if (isAvailable('BOX_ACCESS_TOKEN')) {
    tools.push({ name: 'box_list_files', description: 'Boxのファイル一覧を取得する', parameters: { type: 'object', properties: { folderId: { type: 'string', description: 'フォルダID（省略時はルート）' } }, required: [] } });
    tools.push({ name: 'box_search', description: 'Boxのファイルを検索する', parameters: { type: 'object', properties: { query: { type: 'string', description: '検索クエリ' } }, required: ['query'] } });
  }

  if (isAvailable('ONEDRIVE_CLIENT_ID', 'ONEDRIVE_CLIENT_SECRET', 'ONEDRIVE_REFRESH_TOKEN')) {
    tools.push({ name: 'onedrive_list_files', description: 'OneDriveのファイル一覧を取得する', parameters: { type: 'object', properties: { path: { type: 'string', description: 'フォルダパス（省略可）' } }, required: [] } });
    tools.push({ name: 'onedrive_search', description: 'OneDriveのファイルを検索する', parameters: { type: 'object', properties: { query: { type: 'string', description: '検索クエリ' } }, required: ['query'] } });
  }

  if (isAvailable('TEAMS_WEBHOOK_URL')) {
    tools.push({ name: 'teams_send_message', description: 'Microsoft Teamsにメッセージを送信する', parameters: { type: 'object', properties: { message: { type: 'string', description: '送信するメッセージ' }, channel: { type: 'string', description: 'チャンネル名（省略可）' } }, required: ['message'] } });
  }

  if (isAvailable('OUTLOOK_CLIENT_ID', 'OUTLOOK_CLIENT_SECRET', 'OUTLOOK_REFRESH_TOKEN')) {
    tools.push({ name: 'outlook_list_emails', description: 'Outlookの受信メール一覧を取得する', parameters: { type: 'object', properties: { folder: { type: 'string', description: 'フォルダ名（省略時はInbox）' } }, required: [] } });
    tools.push({ name: 'outlook_send_email', description: 'Outlookでメールを送信する', parameters: { type: 'object', properties: { to: { type: 'string', description: '送信先アドレス' }, subject: { type: 'string', description: '件名' }, body: { type: 'string', description: '本文' } }, required: ['to', 'subject', 'body'] } });
  }

  if (isAvailable('AMPLITUDE_API_KEY', 'AMPLITUDE_SECRET_KEY')) {
    tools.push({ name: 'amplitude_active_users', description: 'Amplitudeのアクティブユーザー数を取得する', parameters: { type: 'object', properties: { start: { type: 'string', description: '開始日 (YYYYMMDD)' }, end: { type: 'string', description: '終了日 (YYYYMMDD)' } }, required: ['start', 'end'] } });
  }

  if (isAvailable('MIXPANEL_PROJECT_TOKEN', 'MIXPANEL_SERVICE_ACCOUNT_USERNAME', 'MIXPANEL_SERVICE_ACCOUNT_SECRET')) {
    tools.push({ name: 'mixpanel_top_events', description: 'Mixpanelのトップイベントを取得する', parameters: { type: 'object', properties: { from_date: { type: 'string', description: '開始日 (YYYY-MM-DD)' }, to_date: { type: 'string', description: '終了日 (YYYY-MM-DD)' } }, required: ['from_date', 'to_date'] } });
  }

  if (isAvailable('GOOGLE_ANALYTICS_PROPERTY_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN')) {
    tools.push({ name: 'ga_page_views', description: 'Google Analyticsのページビューを取得する', parameters: { type: 'object', properties: { days: { type: 'number', description: '過去N日間のデータ（省略時は7日）' } }, required: [] } });
  }

  if (isAvailable('GITHUB_TOKEN')) {
    tools.push({ name: 'github_actions_list_workflows', description: 'GitHub ActionsのWorkflow一覧を取得する', parameters: { type: 'object', properties: { repository: { type: 'string', description: 'リポジトリ名 (owner/repo)' } }, required: ['repository'] } });
    tools.push({ name: 'github_actions_trigger', description: 'GitHub Actionsのワークフローを手動実行する', parameters: { type: 'object', properties: { repository: { type: 'string', description: 'リポジトリ名 (owner/repo)' }, workflowId: { type: 'string', description: 'ワークフローID またはファイル名' }, branch: { type: 'string', description: 'ブランチ名（省略時はmain）' } }, required: ['repository', 'workflowId'] } });
  }

  if (isAvailable('GITLAB_TOKEN', 'GITLAB_URL')) {
    tools.push({ name: 'gitlab_list_projects', description: 'GitLabのプロジェクト一覧を取得する', parameters: { type: 'object', properties: { search: { type: 'string', description: '検索キーワード（省略可）' } }, required: [] } });
    tools.push({ name: 'gitlab_list_mrs', description: 'GitLabのMerge Request一覧を取得する', parameters: { type: 'object', properties: { projectId: { type: 'string', description: 'プロジェクトID' }, state: { type: 'string', description: 'ステータス (opened/closed/merged)', enum: ['opened', 'closed', 'merged'] } }, required: ['projectId'] } });
  }

  if (isAvailable('CIRCLECI_TOKEN')) {
    tools.push({ name: 'circleci_list_pipelines', description: 'CircleCIのパイプライン一覧を取得する', parameters: { type: 'object', properties: { projectSlug: { type: 'string', description: 'プロジェクトスラッグ (gh/owner/repo)' } }, required: ['projectSlug'] } });
    tools.push({ name: 'circleci_trigger', description: 'CircleCIのパイプラインをトリガーする', parameters: { type: 'object', properties: { projectSlug: { type: 'string', description: 'プロジェクトスラッグ' }, branch: { type: 'string', description: 'ブランチ名（省略時はmain）' } }, required: ['projectSlug'] } });
  }

  if (isAvailable('HEROKU_API_KEY')) {
    tools.push({ name: 'heroku_list_apps', description: 'HerokuのApp一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'heroku_restart', description: 'HerokuのDynoを再起動する', parameters: { type: 'object', properties: { appName: { type: 'string', description: 'アプリ名' } }, required: ['appName'] } });
  }

  if (isAvailable('MAILCHIMP_API_KEY')) {
    tools.push({ name: 'mailchimp_list_campaigns', description: 'Mailchimpのキャンペーン一覧を取得する', parameters: { type: 'object', properties: { count: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
    tools.push({ name: 'mailchimp_list_audiences', description: 'Mailchimpのオーディエンス（リスト）一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
  }

  if (isAvailable('BREVO_API_KEY')) {
    tools.push({ name: 'brevo_list_contacts', description: 'Brevoのコンタクト一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
    tools.push({ name: 'brevo_send_email', description: 'Brevoでトランザクションメールを送信する', parameters: { type: 'object', properties: { to: { type: 'string', description: '送信先アドレス' }, subject: { type: 'string', description: '件名' }, content: { type: 'string', description: '本文（HTML可）' } }, required: ['to', 'subject', 'content'] } });
  }

  if (isAvailable('ACTIVECAMPAIGN_API_URL', 'ACTIVECAMPAIGN_API_KEY')) {
    tools.push({ name: 'activecampaign_list_contacts', description: 'ActiveCampaignのコンタクト一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
    tools.push({ name: 'activecampaign_create_contact', description: 'ActiveCampaignにコンタクトを作成する', parameters: { type: 'object', properties: { email: { type: 'string', description: 'メールアドレス' }, firstName: { type: 'string', description: '名（省略可）' }, lastName: { type: 'string', description: '姓（省略可）' } }, required: ['email'] } });
  }

  if (isAvailable('TYPEFORM_API_KEY')) {
    tools.push({ name: 'typeform_list_forms', description: 'Typeformのフォーム一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'typeform_get_responses', description: 'Typeformのフォーム回答を取得する', parameters: { type: 'object', properties: { formId: { type: 'string', description: 'フォームID' }, count: { type: 'number', description: '取得件数（省略可）' } }, required: ['formId'] } });
  }

  if (isAvailable('SURVEYMONKEY_ACCESS_TOKEN')) {
    tools.push({ name: 'surveymonkey_list_surveys', description: 'SurveyMonkeyのアンケート一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
  }

  if (isAvailable('PIPEDRIVE_API_KEY')) {
    tools.push({ name: 'pipedrive_list_deals', description: 'Pipedriveの取引一覧を取得する', parameters: { type: 'object', properties: { status: { type: 'string', description: 'ステータス (open/won/lost/all_not_deleted)', enum: ['open', 'won', 'lost', 'all_not_deleted'] } }, required: [] } });
    tools.push({ name: 'pipedrive_list_persons', description: 'Pipedriveの人物一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
  }

  if (isAvailable('SANSAN_API_KEY')) {
    tools.push({ name: 'sansan_list_contacts', description: 'Sansanの名刺コンタクト一覧を取得する', parameters: { type: 'object', properties: { limit: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
  }

  if (isAvailable('AIRTABLE_API_KEY')) {
    tools.push({ name: 'airtable_list_records', description: 'Airtableのレコード一覧を取得する', parameters: { type: 'object', properties: { baseId: { type: 'string', description: 'ベースID' }, tableId: { type: 'string', description: 'テーブルID' } }, required: ['baseId', 'tableId'] } });
    tools.push({ name: 'airtable_create_record', description: 'Airtableにレコードを作成する', parameters: { type: 'object', properties: { baseId: { type: 'string', description: 'ベースID' }, tableId: { type: 'string', description: 'テーブルID' }, fields: { type: 'string', description: 'フィールドのJSON文字列' } }, required: ['baseId', 'tableId', 'fields'] } });
  }

  if (isAvailable('CODA_API_KEY')) {
    tools.push({ name: 'coda_list_docs', description: 'Codaのドキュメント一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'coda_list_rows', description: 'Codaのテーブル行一覧を取得する', parameters: { type: 'object', properties: { docId: { type: 'string', description: 'ドキュメントID' }, tableId: { type: 'string', description: 'テーブルID' } }, required: ['docId', 'tableId'] } });
  }

  if (isAvailable('LINE_CHANNEL_ACCESS_TOKEN')) {
    tools.push({ name: 'line_push', description: 'LINEのユーザーまたはグループにメッセージを送信する', parameters: { type: 'object', properties: { to: { type: 'string', description: '送信先のユーザーIDまたはグループID' }, message: { type: 'string', description: '送信するメッセージ' } }, required: ['to', 'message'] } });
    tools.push({ name: 'line_broadcast', description: 'LINE公式アカウントの全フォロワーにブロードキャスト送信する', parameters: { type: 'object', properties: { message: { type: 'string', description: 'ブロードキャストするメッセージ' } }, required: ['message'] } });
  }

  if (isAvailable('LINEWORKS_CLIENT_ID', 'LINEWORKS_CLIENT_SECRET', 'LINEWORKS_BOT_ID')) {
    tools.push({ name: 'lineworks_send', description: 'LINE WORKSにメッセージを送信する', parameters: { type: 'object', properties: { channelId: { type: 'string', description: 'チャンネルID' }, message: { type: 'string', description: '送信するメッセージ' } }, required: ['channelId', 'message'] } });
  }

  if (isAvailable('JOBCAN_API_KEY')) {
    tools.push({ name: 'jobcan_list_staff', description: 'ジョブカンのスタッフ一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'jobcan_get_attendance', description: 'ジョブカンの勤怠データを取得する', parameters: { type: 'object', properties: { staffId: { type: 'string', description: 'スタッフID' }, year: { type: 'number', description: '年（例: 2026）' }, month: { type: 'number', description: '月（例: 5）' } }, required: ['staffId', 'year', 'month'] } });
    tools.push({ name: 'jobcan_clock_in', description: 'ジョブカンで出勤打刻をする', parameters: { type: 'object', properties: { note: { type: 'string', description: '備考（省略可）' } }, required: [] } });
    tools.push({ name: 'jobcan_clock_out', description: 'ジョブカンで退勤打刻をする', parameters: { type: 'object', properties: { note: { type: 'string', description: '備考（省略可）' } }, required: [] } });
  }

  if (isAvailable('MFPAYROLL_CLIENT_ID', 'MFPAYROLL_CLIENT_SECRET', 'MFPAYROLL_REFRESH_TOKEN')) {
    tools.push({ name: 'mfpayroll_list_employees', description: 'MFクラウド給与の従業員一覧を取得する', parameters: { type: 'object', properties: { officeId: { type: 'string', description: '事業所ID' } }, required: ['officeId'] } });
    tools.push({ name: 'mfpayroll_list_payslips', description: 'MFクラウド給与の給与明細一覧を取得する', parameters: { type: 'object', properties: { officeId: { type: 'string', description: '事業所ID' }, year: { type: 'number', description: '年' }, month: { type: 'number', description: '月' } }, required: ['officeId', 'year', 'month'] } });
  }

  if (isAvailable('MONEYFORWARD_CLIENT_ID', 'MONEYFORWARD_CLIENT_SECRET', 'MONEYFORWARD_REFRESH_TOKEN')) {
    tools.push({ name: 'moneyforward_list_invoices', description: 'マネーフォワードの請求書一覧を取得する', parameters: { type: 'object', properties: { officeId: { type: 'string', description: '事業所ID' } }, required: ['officeId'] } });
    tools.push({ name: 'moneyforward_list_expenses', description: 'マネーフォワードの経費一覧を取得する', parameters: { type: 'object', properties: { officeId: { type: 'string', description: '事業所ID' } }, required: ['officeId'] } });
  }

  if (isAvailable('YAYOI_API_KEY')) {
    tools.push({ name: 'yayoi_trial_balance', description: '弥生の試算表を取得する', parameters: { type: 'object', properties: { companyId: { type: 'string', description: '会社ID' } }, required: ['companyId'] } });
  }

  if (isAvailable('LAUNCHDARKLY_API_KEY')) {
    tools.push({ name: 'launchdarkly_list_flags', description: 'LaunchDarklyのフィーチャーフラグ一覧を取得する', parameters: { type: 'object', properties: { projectKey: { type: 'string', description: 'プロジェクトキー' } }, required: ['projectKey'] } });
    tools.push({ name: 'launchdarkly_toggle_flag', description: 'LaunchDarklyのフィーチャーフラグをON/OFFする', parameters: { type: 'object', properties: { projectKey: { type: 'string', description: 'プロジェクトキー' }, flagKey: { type: 'string', description: 'フラグキー' }, envKey: { type: 'string', description: '環境キー（例: production）' }, enabled: { type: 'boolean', description: 'true=ON / false=OFF' } }, required: ['projectKey', 'flagKey', 'envKey', 'enabled'] } });
  }

  if (isAvailable('STATUSPAGE_API_KEY')) {
    tools.push({ name: 'statuspage_list_incidents', description: 'Statuspageのインシデント一覧を取得する', parameters: { type: 'object', properties: { pageId: { type: 'string', description: 'ページID' } }, required: ['pageId'] } });
    tools.push({ name: 'statuspage_create_incident', description: 'Statuspageにインシデントを作成する', parameters: { type: 'object', properties: { pageId: { type: 'string', description: 'ページID' }, name: { type: 'string', description: 'インシデント名' }, status: { type: 'string', description: 'ステータス (investigating/identified/monitoring/resolved)', enum: ['investigating', 'identified', 'monitoring', 'resolved'] } }, required: ['pageId', 'name', 'status'] } });
  }

  if (isAvailable('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION')) {
    tools.push({ name: 'aws_cloudwatch_alarms', description: 'AWS CloudWatchのアラーム一覧を取得する', parameters: { type: 'object', properties: { region: { type: 'string', description: 'AWSリージョン（省略時は設定値）' } }, required: [] } });
    tools.push({ name: 'aws_s3_list_buckets', description: 'AWS S3のバケット一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'aws_s3_list_objects', description: 'AWS S3バケットのオブジェクト一覧を取得する', parameters: { type: 'object', properties: { bucket: { type: 'string', description: 'バケット名' }, prefix: { type: 'string', description: 'プレフィックス（省略可）' } }, required: ['bucket'] } });
  }

  if (isAvailable('SQUARE_ACCESS_TOKEN')) {
    tools.push({ name: 'square_list_transactions', description: 'Squareの取引一覧を取得する', parameters: { type: 'object', properties: { locationId: { type: 'string', description: 'ロケーションID（省略可）' } }, required: [] } });
  }

  if (isAvailable('CLOUDSIGN_API_KEY')) {
    tools.push({ name: 'cloudsign_list_documents', description: 'クラウドサインの書類一覧を取得する', parameters: { type: 'object', properties: { status: { type: 'string', description: 'ステータス（省略可）' } }, required: [] } });
  }

  if (isAvailable('DOCUSIGN_ACCESS_TOKEN', 'DOCUSIGN_ACCOUNT_ID')) {
    tools.push({ name: 'docusign_list_envelopes', description: 'DocuSignのエンベロープ一覧を取得する', parameters: { type: 'object', properties: { status: { type: 'string', description: 'ステータス (sent/delivered/completed/declined)', enum: ['sent', 'delivered', 'completed', 'declined'] } }, required: [] } });
  }

  if (isAvailable('FREEE_SIGN_API_KEY')) {
    tools.push({ name: 'freeesign_list_contracts', description: 'freeeサインの契約書一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
  }

  if (isAvailable('FREEEHR_CLIENT_ID', 'FREEEHR_CLIENT_SECRET', 'FREEEHR_REFRESH_TOKEN')) {
    tools.push({ name: 'freeehr_list_employees', description: 'freee人事労務の従業員一覧を取得する', parameters: { type: 'object', properties: { companyId: { type: 'string', description: '会社ID' } }, required: ['companyId'] } });
  }

  if (isAvailable('RECEPTIONIST_API_KEY')) {
    tools.push({ name: 'receptionist_list_visitors', description: 'RECEPTIONIST（受付）の来訪者一覧を取得する', parameters: { type: 'object', properties: { date: { type: 'string', description: '日付 (YYYY-MM-DD形式、省略時は本日)' } }, required: [] } });
  }

  if (isAvailable('TALENTIO_API_KEY')) {
    tools.push({ name: 'talentio_list_jobs', description: 'Talentioの求人一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'talentio_list_candidates', description: 'Talentioの候補者一覧を取得する', parameters: { type: 'object', properties: { jobId: { type: 'number', description: '求人ID（省略可）' } }, required: [] } });
  }

  if (isAvailable('WANTEDLY_CLIENT_ID', 'WANTEDLY_CLIENT_SECRET', 'WANTEDLY_ACCESS_TOKEN')) {
    tools.push({ name: 'wantedly_list_jobs', description: 'Wantedlyの求人一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
  }

  if (isAvailable('CYBOZU_BASE_URL', 'CYBOZU_USER', 'CYBOZU_PASSWORD')) {
    tools.push({ name: 'cybozu_list_schedules', description: 'サイボウズOfficeのスケジュール一覧を取得する', parameters: { type: 'object', properties: { date: { type: 'string', description: '日付 (YYYYMMDD形式、省略時は本日)' } }, required: [] } });
  }

  if (isAvailable('CALENDLY_ACCESS_TOKEN')) {
    tools.push({ name: 'calendly_list_event_types', description: 'Calendlyのイベントタイプ一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'calendly_list_scheduled_events', description: 'Calendlyの予約済みイベント一覧を取得する', parameters: { type: 'object', properties: { count: { type: 'number', description: '取得件数（省略可）' } }, required: [] } });
  }

  if (isAvailable('WEBFLOW_API_TOKEN')) {
    tools.push({ name: 'webflow_list_sites', description: 'Webflowのサイト一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'webflow_publish_site', description: 'Webflowのサイトを公開する', parameters: { type: 'object', properties: { siteId: { type: 'string', description: 'サイトID' } }, required: ['siteId'] } });
  }

  if (isAvailable('N8N_API_URL', 'N8N_API_KEY')) {
    tools.push({ name: 'n8n_list_workflows', description: 'n8nのワークフロー一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'n8n_trigger', description: 'n8nのWebhookワークフローをトリガーする', parameters: { type: 'object', properties: { webhookUrl: { type: 'string', description: 'n8nのWebhook URL' }, data: { type: 'string', description: '送信するJSONデータ（省略可）' } }, required: ['webhookUrl'] } });
  }

  if (isAvailable('ZAPIER_WEBHOOK_URL')) {
    tools.push({ name: 'zapier_trigger', description: 'ZapierのWebhookをトリガーしてZapを実行する', parameters: { type: 'object', properties: { data: { type: 'string', description: '送信するJSONデータ（省略可）' } }, required: [] } });
  }

  if (isAvailable('MAKE_API_KEY')) {
    tools.push({ name: 'make_list_scenarios', description: 'Make（旧Integromat）のシナリオ一覧を取得する', parameters: { type: 'object', properties: { teamId: { type: 'number', description: 'チームID（省略可）' } }, required: [] } });
    tools.push({ name: 'make_trigger', description: 'MakeのWebhookシナリオをトリガーする', parameters: { type: 'object', properties: { webhookUrl: { type: 'string', description: 'MakeのWebhook URL' }, data: { type: 'string', description: '送信するJSONデータ（省略可）' } }, required: ['webhookUrl'] } });
  }

  if (isAvailable('TIKTOK_ADS_ACCESS_TOKEN', 'TIKTOK_ADS_APP_ID')) {
    tools.push({ name: 'tiktokads_list_campaigns', description: 'TikTok広告のキャンペーン一覧を取得する', parameters: { type: 'object', properties: { advertiserId: { type: 'string', description: '広告主ID' } }, required: ['advertiserId'] } });
  }

  if (isAvailable('META_ACCESS_TOKEN')) {
    tools.push({ name: 'metaads_list_campaigns', description: 'Meta（Facebook/Instagram）広告のキャンペーン一覧を取得する', parameters: { type: 'object', properties: { adAccountId: { type: 'string', description: '広告アカウントID (act_XXXXXXXX)' } }, required: ['adAccountId'] } });
  }

  if (isAvailable('VONAGE_API_KEY', 'VONAGE_API_SECRET')) {
    tools.push({ name: 'vonage_send_sms', description: 'VonageでSMSを送信する', parameters: { type: 'object', properties: { to: { type: 'string', description: '送信先電話番号 (E.164形式)' }, from: { type: 'string', description: '送信元番号またはブランド名' }, message: { type: 'string', description: '送信するメッセージ' } }, required: ['to', 'from', 'message'] } });
  }

  if (isAvailable('CLOUDFLARE_API_TOKEN')) {
    tools.push({ name: 'cloudflare_list_zones', description: 'CloudflareのZone（ドメイン）一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
    tools.push({ name: 'cloudflare_purge_cache', description: 'CloudflareのキャッシュをPurgeする', parameters: { type: 'object', properties: { zoneId: { type: 'string', description: 'ZoneID' } }, required: ['zoneId'] } });
  }

  if (isAvailable('POSTMARK_API_TOKEN')) {
    tools.push({ name: 'postmark_send', description: 'Postmarkでトランザクションメールを送信する', parameters: { type: 'object', properties: { to: { type: 'string', description: '送信先アドレス' }, subject: { type: 'string', description: '件名' }, body: { type: 'string', description: '本文（HTML可）' }, from: { type: 'string', description: '送信元アドレス（省略可）' } }, required: ['to', 'subject', 'body'] } });
  }

  if (isAvailable('OPENAI_API_KEY')) {
    tools.push({ name: 'openai_list_models', description: 'OpenAI APIで利用可能なモデル一覧を取得する', parameters: { type: 'object', properties: {}, required: [] } });
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
        return `🎨 **画像を生成しました！**\n🔗 ${imgResult.url}\n\nサイズ: ${imgResult.width}×${imgResult.height}`;
      }
      case 'generate_video': {
        // 動画生成は時間がかかるため「生成開始」を即返し、バックグラウンドで処理
        const vidPrompt = args.prompt as string;
        const vidDuration = (args.duration as 5 | 10) ?? 5;
        const vidRatio = (args.aspect_ratio as '16:9' | '9:16' | '1:1') ?? '16:9';
        const vidImageUrl = args.image_url as string | undefined;
        const channelId = args.channel_id as string | undefined;
        console.log(`[Video] channelId=${channelId}, prompt=${vidPrompt.slice(0,50)}`);

        // 非同期で生成開始（awaitしない）
        const vidPromise = vidImageUrl
          ? imageToVideo(vidImageUrl, vidPrompt, vidDuration)
          : generateVideo(vidPrompt, vidDuration, vidRatio);

        vidPromise
          .then(async (result) => {
            console.log(`[Tool] Video generation complete: ${result.url}`);

            if (!channelId) {
              return;
            }

            const completionMessage = [
              '🎬 **動画生成が完了しました！**',
              `🔗 ${result.url}`,
              '',
              `長さ: ${vidDuration}秒 / ${vidRatio}`,
              vidImageUrl ? `元画像: ${vidImageUrl}` : '生成方式: text-to-video',
              `プロンプト: ${truncate(vidPrompt, 300)}`,
            ].join('\n');

            await sendDiscordMessage(channelId, completionMessage);
          })
          .catch(async (err: Error) => {
            console.error(`[Tool] Video generation failed: ${err.message}`);

            if (!channelId) {
              return;
            }

            try {
              await sendDiscordMessage(
                channelId,
                [
                  '⚠️ **動画生成に失敗しました**',
                  `長さ: ${vidDuration}秒 / ${vidRatio}`,
                  `理由: ${truncate(err.message, 300)}`,
                  `プロンプト: ${truncate(vidPrompt, 300)}`,
                ].join('\n')
              );
            } catch (notifyError) {
              console.error('[Tool] Failed to send video failure notification:', notifyError);
            }
          });

        return `🎬 **動画生成を開始しました！**\n\n⏳ Kling v2.1で生成中（約1〜2分）\n\n完了したら自動でお知らせします。\n\nプロンプト: ${vidPrompt.slice(0, 100)}`;
      }

      default:
        // ── Week65追加: 75ツール実行ロジック ──
        return await executeExtendedToolCall(toolName, args);
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
