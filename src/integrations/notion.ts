import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

const NOTION_VERSION = '2022-06-28';
const NOTION_RICH_TEXT_LIMIT = 1800;

type NotionRichText = {
  plain_text?: string;
};

type NotionPageProperty = {
  type: string;
  title?: NotionRichText[];
};

type NotionSearchPage = {
  object: 'page';
  id: string;
  url: string;
  last_edited_time: string;
  properties?: Record<string, NotionPageProperty>;
};

type NotionSearchResponse = {
  results: NotionSearchPage[];
};

type NotionDatabaseResponse = {
  title?: NotionRichText[];
  properties: Record<
    string,
    {
      id: string;
      type: string;
    }
  >;
};

type NotionCreatePageResponse = {
  id: string;
  url: string;
};

export type NotionPageSummary = {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
};

export type NotionCreatedPage = {
  id: string;
  url: string;
};

function getHeaders(): Record<string, string> {
  const apiKey = requireEnvVar('NOTION_API_KEY', 'Notion');

  return {
    Authorization: `Bearer ${apiKey}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

function getDatabaseId(): string {
  return requireEnvVar('NOTION_DATABASE_ID', 'Notion');
}

function extractTitleFromProperties(properties?: Record<string, NotionPageProperty>): string {
  if (!properties) {
    return '無題';
  }

  for (const property of Object.values(properties)) {
    if (property.type !== 'title') {
      continue;
    }

    const title = (property.title ?? []).map((item) => item.plain_text ?? '').join('').trim();
    return title || '無題';
  }

  return '無題';
}

function splitRichText(content: string): string[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return ['(本文なし)'];
  }

  const chunks: string[] = [];

  for (const paragraph of normalized.split(/\n{2,}/)) {
    const lines = paragraph.split('\n').filter((line) => line.trim().length > 0);
    const mergedParagraph = lines.length > 0 ? lines.join('\n') : paragraph;

    for (let start = 0; start < mergedParagraph.length; start += NOTION_RICH_TEXT_LIMIT) {
      chunks.push(mergedParagraph.slice(start, start + NOTION_RICH_TEXT_LIMIT));
    }
  }

  return chunks.length > 0 ? chunks : ['(本文なし)'];
}

async function getTitlePropertyName(): Promise<string> {
  const databaseId = getDatabaseId();
  const database = await fetchJson<NotionDatabaseResponse>(
    `https://api.notion.com/v1/databases/${databaseId}`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'Notionデータベース情報の取得に失敗しました。NOTION_DATABASE_ID が正しいか確認してください。'
  );

  const titlePropertyEntry = Object.entries(database.properties).find(([, property]) => {
    return property.type === 'title';
  });

  if (!titlePropertyEntry) {
    throw new IntegrationError('Notionデータベースにタイトル列が見つかりませんでした。');
  }

  return titlePropertyEntry[0];
}

export async function searchNotionPages(keyword: string): Promise<NotionPageSummary[]> {
  getDatabaseId();

  const response = await fetchJson<NotionSearchResponse>(
    'https://api.notion.com/v1/search',
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        query: keyword,
        filter: {
          property: 'object',
          value: 'page',
        },
        sort: {
          direction: 'descending',
          timestamp: 'last_edited_time',
        },
      }),
    },
    'Notionページの検索に失敗しました。APIキーやワークスペース共有設定を確認してください。'
  );

  return response.results.map((page) => ({
    id: page.id,
    title: extractTitleFromProperties(page.properties),
    url: page.url,
    lastEditedTime: page.last_edited_time,
  }));
}

export async function createNotionPage(title: string, content: string): Promise<NotionCreatedPage> {
  const databaseId = getDatabaseId();
  const titlePropertyName = await getTitlePropertyName();
  const children = splitRichText(content).map((text) => ({
    object: 'block' as const,
    type: 'paragraph' as const,
    paragraph: {
      rich_text: [
        {
          type: 'text' as const,
          text: {
            content: text,
          },
        },
      ],
    },
  }));

  const response = await fetchJson<NotionCreatePageResponse>(
    'https://api.notion.com/v1/pages',
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        parent: {
          database_id: databaseId,
        },
        properties: {
          [titlePropertyName]: {
            title: [
              {
                type: 'text',
                text: {
                  content: title,
                },
              },
            ],
          },
        },
        children,
      }),
    },
    'Notionページの作成に失敗しました。データベース権限と入力内容を確認してください。'
  );

  return {
    id: response.id,
    url: response.url,
  };
}
