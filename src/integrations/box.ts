import { IntegrationError } from './errors';
import { fetchJson } from './http';

const BOX_API_BASE_URL = 'https://api.box.com/2.0';

type BoxFolderItemsResponse = {
  entries?: Array<{
    id?: string;
    name?: string;
    type?: string;
    size?: number;
    modified_at?: string;
  }>;
};

type BoxFileResponse = {
  id?: string;
  name?: string;
  size?: number;
  download_url?: string;
};

type BoxSearchResponse = {
  entries?: Array<{
    id?: string;
    name?: string;
    type?: string;
    parent?: {
      name?: string;
    };
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Boxのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeToken(token)}`,
  };
}

export async function listFiles(
  token: string,
  folderId?: string
): Promise<
  Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    modified_at: string;
  }>
> {
  const normalizedFolderId = folderId?.trim() || '0';
  const response = await fetchJson<BoxFolderItemsResponse>(
    `${BOX_API_BASE_URL}/folders/${encodeURIComponent(normalizedFolderId)}/items`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Boxのファイル一覧取得に失敗しました。'
  );

  return (response.entries ?? []).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : '',
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : '(No name)',
    type: typeof entry.type === 'string' ? entry.type : 'unknown',
    size: typeof entry.size === 'number' ? entry.size : 0,
    modified_at: typeof entry.modified_at === 'string' ? entry.modified_at : '',
  }));
}

export async function getFile(
  token: string,
  fileId: string
): Promise<{ id: string; name: string; size: number; download_url: string }> {
  const normalizedFileId = fileId.trim();

  if (!normalizedFileId) {
    throw new IntegrationError('Boxのfile IDを指定してください。');
  }

  const response = await fetchJson<BoxFileResponse>(
    `${BOX_API_BASE_URL}/files/${encodeURIComponent(normalizedFileId)}`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Boxのファイル情報取得に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    name: typeof response.name === 'string' && response.name.trim() ? response.name : '(No name)',
    size: typeof response.size === 'number' ? response.size : 0,
    download_url: typeof response.download_url === 'string' ? response.download_url : '',
  };
}

export async function searchFiles(
  token: string,
  query: string
): Promise<Array<{ id: string; name: string; type: string; parent_name: string }>> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new IntegrationError('Boxの検索queryを指定してください。');
  }

  const response = await fetchJson<BoxSearchResponse>(
    `${BOX_API_BASE_URL}/search?query=${encodeURIComponent(normalizedQuery)}&limit=20`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Boxのファイル検索に失敗しました。'
  );

  return (response.entries ?? []).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : '',
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : '(No name)',
    type: typeof entry.type === 'string' ? entry.type : 'unknown',
    parent_name:
      typeof entry.parent?.name === 'string' && entry.parent.name.trim()
        ? entry.parent.name
        : '-',
  }));
}
