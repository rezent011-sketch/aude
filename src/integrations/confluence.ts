import { IntegrationError } from './errors';
import { fetchJson } from './http';

type ConfluenceSpacesResponse = {
  results?: Array<{
    id?: string;
    key?: string;
    name?: string;
    type?: string;
  }>;
};

type ConfluenceSearchResponse = {
  results?: Array<{
    id?: string;
    title?: string;
    space?: {
      key?: string;
    };
    _links?: {
      webui?: string;
    };
  }>;
};

type ConfluenceCreatePageResponse = {
  id?: string;
  title?: string;
  _links?: {
    webui?: string;
  };
};

function normalizeEmail(email: string): string {
  const trimmed = email.trim();

  if (!trimmed) {
    throw new IntegrationError('Confluenceのemailが設定されていません。');
  }

  return trimmed;
}

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('ConfluenceのAPI tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeDomain(domain: string): string {
  const trimmed = domain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\.atlassian\.net$/i, '')
    .replace(/\/wiki$/i, '');

  if (!trimmed) {
    throw new IntegrationError('Confluenceのdomainが設定されていません。');
  }

  return trimmed;
}

function getAuthHeader(email: string, token: string): string {
  return `Basic ${Buffer.from(`${normalizeEmail(email)}:${normalizeToken(token)}`).toString('base64')}`;
}

function getBaseUrl(domain: string): string {
  return `https://${normalizeDomain(domain)}.atlassian.net/wiki`;
}

function getHeaders(email: string, token: string): Record<string, string> {
  return {
    Authorization: getAuthHeader(email, token),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function getSpaces(
  email: string,
  token: string,
  domain: string
): Promise<Array<{ id: string; key: string; name: string; type: string }>> {
  const baseUrl = getBaseUrl(domain);
  const response = await fetchJson<ConfluenceSpacesResponse>(
    `${baseUrl}/api/v2/spaces?limit=20`,
    {
      method: 'GET',
      headers: getHeaders(email, token),
    },
    'Confluenceのスペース一覧取得に失敗しました。'
  );

  return (response.results ?? []).map((space) => ({
    id: typeof space.id === 'string' ? space.id : '',
    key: typeof space.key === 'string' ? space.key : '',
    name: typeof space.name === 'string' && space.name.trim() ? space.name : '(No name)',
    type: typeof space.type === 'string' ? space.type : 'unknown',
  }));
}

export async function searchPages(
  email: string,
  token: string,
  domain: string,
  query: string
): Promise<Array<{ id: string; title: string; spaceKey: string; url: string }>> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new IntegrationError('Confluenceの検索queryを指定してください。');
  }

  const baseUrl = getBaseUrl(domain);
  const cql = `type=page AND text~"${normalizedQuery.replace(/"/g, '\\"')}"`;
  const response = await fetchJson<ConfluenceSearchResponse>(
    `${baseUrl}/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=10`,
    {
      method: 'GET',
      headers: getHeaders(email, token),
    },
    'Confluenceのページ検索に失敗しました。'
  );

  return (response.results ?? []).map((page) => ({
    id: typeof page.id === 'string' ? page.id : '',
    title: typeof page.title === 'string' && page.title.trim() ? page.title : '(No title)',
    spaceKey: typeof page.space?.key === 'string' ? page.space.key : '',
    url:
      typeof page._links?.webui === 'string' && page._links.webui
        ? `${baseUrl}${page._links.webui}`
        : '',
  }));
}

export async function createPage(
  email: string,
  token: string,
  domain: string,
  spaceKey: string,
  title: string,
  body: string
): Promise<{ id: string; title: string; url: string }> {
  const normalizedSpaceKey = spaceKey.trim();
  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();

  if (!normalizedSpaceKey) {
    throw new IntegrationError('Confluenceのspace keyを指定してください。');
  }

  if (!normalizedTitle) {
    throw new IntegrationError('Confluenceのtitleを指定してください。');
  }

  if (!normalizedBody) {
    throw new IntegrationError('Confluenceのbodyを指定してください。');
  }

  const baseUrl = getBaseUrl(domain);
  const response = await fetchJson<ConfluenceCreatePageResponse>(
    `${baseUrl}/rest/api/content`,
    {
      method: 'POST',
      headers: getHeaders(email, token),
      body: JSON.stringify({
        type: 'page',
        title: normalizedTitle,
        space: { key: normalizedSpaceKey },
        body: {
          storage: {
            value: normalizedBody,
            representation: 'storage',
          },
        },
      }),
    },
    'Confluenceのページ作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    title:
      typeof response.title === 'string' && response.title.trim() ? response.title : normalizedTitle,
    url:
      typeof response._links?.webui === 'string' && response._links.webui
        ? `${baseUrl}${response._links.webui}`
        : '',
  };
}
