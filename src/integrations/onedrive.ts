import { IntegrationError } from './errors';
import { fetchJson } from './http';

const MICROSOFT_GRAPH_DRIVE_BASE_URL = 'https://graph.microsoft.com/v1.0/me/drive';

type OneDriveFilesResponse = {
  value?: Array<{
    id?: string;
    name?: string;
    size?: number;
    lastModifiedDateTime?: string;
    webUrl?: string;
    folder?: Record<string, unknown>;
  }>;
};

type OneDriveSearchResponse = {
  value?: Array<{
    id?: string;
    name?: string;
    webUrl?: string;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('OneDriveのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeToken(token)}`,
    'Content-Type': 'application/json',
  };
}

export async function listFiles(
  token: string,
  folderId?: string
): Promise<
  Array<{
    id: string;
    name: string;
    size: number;
    lastModifiedDateTime: string;
    webUrl: string;
    isFolder: boolean;
  }>
> {
  const normalizedFolderId = folderId?.trim();
  const path = normalizedFolderId
    ? `/items/${encodeURIComponent(normalizedFolderId)}/children`
    : '/root/children';
  const response = await fetchJson<OneDriveFilesResponse>(
    `${MICROSOFT_GRAPH_DRIVE_BASE_URL}${path}`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'OneDriveのファイル一覧取得に失敗しました。'
  );

  return (response.value ?? []).map((item) => ({
    id: typeof item.id === 'string' ? item.id : '',
    name: typeof item.name === 'string' && item.name.trim() ? item.name : '(No name)',
    size: typeof item.size === 'number' ? item.size : 0,
    lastModifiedDateTime:
      typeof item.lastModifiedDateTime === 'string' ? item.lastModifiedDateTime : '',
    webUrl: typeof item.webUrl === 'string' ? item.webUrl : '',
    isFolder: !!item.folder,
  }));
}

export async function searchFiles(
  token: string,
  query: string
): Promise<Array<{ id: string; name: string; webUrl: string }>> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new IntegrationError('OneDriveの検索queryを指定してください。');
  }

  const response = await fetchJson<OneDriveSearchResponse>(
    `${MICROSOFT_GRAPH_DRIVE_BASE_URL}/root/search(q='${encodeURIComponent(normalizedQuery)}')`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'OneDriveのファイル検索に失敗しました。'
  );

  return (response.value ?? []).map((item) => ({
    id: typeof item.id === 'string' ? item.id : '',
    name: typeof item.name === 'string' && item.name.trim() ? item.name : '(No name)',
    webUrl: typeof item.webUrl === 'string' ? item.webUrl : '',
  }));
}
