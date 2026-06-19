export type IntegrationName = 'github' | 'google' | 'notion';

export type IntegrationDefinition = {
  name: IntegrationName;
  displayName: string;
  description: string;
  requiredEnvVars: string[];
  setupInstructions: string[];
};

export type IntegrationStatus = {
  name: IntegrationName;
  isConfigured: boolean;
  missingEnvVars: string[];
};

const integrations: Record<IntegrationName, IntegrationDefinition> = {
  github: {
    name: 'github',
    displayName: 'GitHub',
    description: 'Issue 一覧、Issue 作成、Pull Request 作成',
    requiredEnvVars: ['GITHUB_TOKEN'],
    setupInstructions: [
      '`GITHUB_TOKEN` を設定してください。',
      '必要権限は対象リポジトリへの Issue / Pull Request 書き込み権限です。',
      'GitHub App ではなく Personal Access Token を使う場合は repo スコープを確認してください。',
    ],
  },
  google: {
    name: 'google',
    displayName: 'Google Workspace',
    description: 'Google Calendar と Google Sheets の操作',
    requiredEnvVars: [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN',
    ],
    setupInstructions: [
      '`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`GOOGLE_REFRESH_TOKEN` を設定してください。',
      'Google Cloud で Calendar API と Sheets API を有効化してください。',
      'OAuth クライアントに Calendar / Sheets へアクセスできるリフレッシュトークンを紐づけてください。',
    ],
  },
  notion: {
    name: 'notion',
    displayName: 'Notion',
    description: 'ページ検索、ページ作成、データベースクエリ',
    requiredEnvVars: ['NOTION_API_KEY', 'NOTION_DATABASE_ID'],
    setupInstructions: [
      '`NOTION_API_KEY` と `NOTION_DATABASE_ID` を設定してください。',
      '対象データベースを Notion integration に共有してください。',
      'データベースに title 型のカラムが存在することを確認してください。',
    ],
  },
};

export function getIntegration(name: string): IntegrationDefinition | undefined {
  return integrations[name as IntegrationName];
}

export function listAvailableIntegrations(): IntegrationDefinition[] {
  return Object.values(integrations).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export function checkIntegrationStatus(name: string): IntegrationStatus {
  const integration = getIntegration(name);

  if (!integration) {
    throw new Error(`Unknown integration: ${name}`);
  }

  const missingEnvVars = integration.requiredEnvVars.filter((envVar) => {
    const value = process.env[envVar];
    return !value || !value.trim();
  });

  return {
    name: integration.name,
    isConfigured: missingEnvVars.length === 0,
    missingEnvVars,
  };
}
