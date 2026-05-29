import { ModelChoice, LLMMessage, routeToLLM } from '../llm/router';

type IntegrationIntent = {
  name: string;
  envKeys: string[];
  patterns: RegExp[];
};

const INTEGRATION_INTENTS: IntegrationIntent[] = [
  {
    name: 'GitHub',
    envKeys: ['GITHUB_TOKEN'],
    patterns: [/github/i, /ギットハブ/, /git hub/i],
  },
  {
    name: 'Notion',
    envKeys: ['NOTION_API_KEY'],
    patterns: [/notion/i, /ノーション/],
  },
  {
    name: 'Google Workspace',
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
    patterns: [
      /gmail/i,
      /google\s*calendar/i,
      /google\s*drive/i,
      /google\s*sheets/i,
      /google workspace/i,
      /カレンダー/,
      /予定確認/,
      /予定を確認/,
      /予定見せ/,
      /予定を見せ/,
      /来週の予定/,
      /ドライブ/,
      /スプレッドシート/,
    ],
  },
  {
    name: 'Slack',
    envKeys: ['SLACK_BOT_TOKEN'],
    patterns: [/slack/i],
  },
  {
    name: 'Linear',
    envKeys: ['LINEAR_API_KEY'],
    patterns: [/linear/i],
  },
  {
    name: 'Jira',
    envKeys: ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
    patterns: [/jira/i],
  },
  {
    name: 'Trello',
    envKeys: ['TRELLO_API_KEY', 'TRELLO_TOKEN'],
    patterns: [/trello/i],
  },
  {
    name: 'Zoom',
    envKeys: ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET', 'ZOOM_ACCOUNT_ID'],
    patterns: [/zoom/i],
  },
  {
    name: 'Figma',
    envKeys: ['FIGMA_ACCESS_TOKEN'],
    patterns: [/figma/i],
  },
  {
    name: 'Discord',
    envKeys: ['DISCORD_TOKEN'],
    patterns: [/discord/i],
  },
  {
    name: 'Google Analytics',
    envKeys: [
      'GOOGLE_ANALYTICS_PROPERTY_ID',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN',
    ],
    patterns: [/google analytics/i, /\bga4\b/i, /アクセス解析/],
  },
  {
    name: 'Asana',
    envKeys: ['ASANA_ACCESS_TOKEN'],
    patterns: [/asana/i],
  },
  {
    name: 'ClickUp',
    envKeys: ['CLICKUP_API_KEY'],
    patterns: [/clickup/i],
  },
  {
    name: 'Monday.com',
    envKeys: ['MONDAY_API_KEY'],
    patterns: [/monday/i],
  },
  {
    name: 'Dropbox',
    envKeys: ['DROPBOX_ACCESS_TOKEN'],
    patterns: [/dropbox/i],
  },
  {
    name: 'OneDrive',
    envKeys: ['ONEDRIVE_ACCESS_TOKEN'],
    patterns: [/onedrive/i, /one drive/i],
  },
  {
    name: 'Box',
    envKeys: ['BOX_CLIENT_ID', 'BOX_CLIENT_SECRET', 'BOX_ENTERPRISE_ID', 'BOX_JWT_PRIVATE_KEY'],
    patterns: [/\bbox\b/i],
  },
  {
    name: 'Outlook',
    envKeys: ['OUTLOOK_ACCESS_TOKEN'],
    patterns: [/outlook/i],
  },
  {
    name: 'Salesforce',
    envKeys: [
      'SALESFORCE_CLIENT_ID',
      'SALESFORCE_CLIENT_SECRET',
      'SALESFORCE_REFRESH_TOKEN',
      'SALESFORCE_INSTANCE_URL',
    ],
    patterns: [/salesforce/i],
  },
  {
    name: 'HubSpot',
    envKeys: ['HUBSPOT_ACCESS_TOKEN'],
    patterns: [/hubspot/i],
  },
];

function isConfigured(envKeys: string[]): boolean {
  return envKeys.every((envKey) => Boolean(process.env[envKey]?.trim()));
}

function detectMissingIntegrationIntent(message: string): IntegrationIntent | null {
  for (const intent of INTEGRATION_INTENTS) {
    if (!intent.patterns.some((pattern) => pattern.test(message))) {
      continue;
    }

    if (!isConfigured(intent.envKeys)) {
      return intent;
    }
  }

  return null;
}

const NATURAL_LANGUAGE_INSTRUCTION = [
  'ユーザーはスラッシュコマンドではなく通常メッセージでAudeを操作しています。',
  '利用可能なツールで解決できる依頼は、必ず適切なツールを自動実行して結果を日本語で返してください。',
  'どのツールにも該当しない依頼は、通常の会話として日本語で返答してください。',
].join('\n');

export async function routeNaturalLanguageMessage(params: {
  prompt: string;
  selectedModel: ModelChoice;
  messages: LLMMessage[];
  channelId: string;
  guildId?: string;
  memoryContext?: string;
}): Promise<string> {
  const missingIntegration = detectMissingIntegrationIntent(params.prompt);
  if (missingIntegration) {
    return `${missingIntegration.name}を連携すれば使えます。.envに${missingIntegration.envKeys.join('、')}を追加してください。`;
  }

  const memoryContext = [params.memoryContext, NATURAL_LANGUAGE_INSTRUCTION]
    .filter(Boolean)
    .join('\n\n');

  return routeToLLM(
    params.prompt,
    params.selectedModel,
    params.messages,
    params.channelId,
    memoryContext || undefined,
    params.guildId,
    true
  );
}
