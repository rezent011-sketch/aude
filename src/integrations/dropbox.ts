import { IntegrationError } from './errors';
import { fetchJson } from './http';

const DROPBOX_API_BASE_URL = 'https://api.dropboxapi.com/2';

type DropboxListFolderResponse = {
  entries?: Array<{
    id?: string;
    name?: string;
    path_display?: string;
    '.tag'?: 'folder' | 'file' | string;
    size?: number;
  }>;
};

type DropboxMetadataResponse = {
  id?: string;
  name?: string;
  path_display?: string;
  size?: number;
  server_modified?: string;
};

type DropboxSearchResponse = {
  matches?: Array<{
    metadata?: {
      metadata?: {
        name?: string;
        path_display?: string;
      };
    };
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Dropboxのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeToken(token)}`,
    'Content-Type': 'application/json',
  };
}

export async function listFolder(
  token: string,
  path?: string
): Promise<
  Array<{
    id: string;
    name: string;
    path_display: string;
    is_folder: boolean;
    size?: number;
  }>
> {
  const response = await fetchJson<DropboxListFolderResponse>(
    `${DROPBOX_API_BASE_URL}/files/list_folder`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        path: path?.trim() || '',
        recursive: false,
      }),
    },
    'Dropboxのフォルダ一覧取得に失敗しました。'
  );

  return (response.entries ?? []).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : '',
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : '(No name)',
    path_display: typeof entry.path_display === 'string' ? entry.path_display : '',
    is_folder: entry['.tag'] === 'folder',
    size: typeof entry.size === 'number' ? entry.size : undefined,
  }));
}

export async function getMetadata(
  token: string,
  path: string
): Promise<{
  id: string;
  name: string;
  path_display: string;
  size?: number;
  server_modified?: string;
}> {
  const normalizedPath = path.trim();

  if (!normalizedPath) {
    throw new IntegrationError('Dropboxのpathを指定してください。');
  }

  const response = await fetchJson<DropboxMetadataResponse>(
    `${DROPBOX_API_BASE_URL}/files/get_metadata`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        path: normalizedPath,
      }),
    },
    'Dropboxのメタデータ取得に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    name: typeof response.name === 'string' && response.name.trim() ? response.name : '(No name)',
    path_display: typeof response.path_display === 'string' ? response.path_display : '',
    size: typeof response.size === 'number' ? response.size : undefined,
    server_modified:
      typeof response.server_modified === 'string' ? response.server_modified : undefined,
  };
}

export async function search(
  token: string,
  query: string
): Promise<Array<{ name: string; path_display: string }>> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new IntegrationError('Dropboxの検索queryを指定してください。');
  }

  const response = await fetchJson<DropboxSearchResponse>(
    `${DROPBOX_API_BASE_URL}/files/search_v2`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        query: normalizedQuery,
      }),
    },
    'Dropboxの検索に失敗しました。'
  );

  return (response.matches ?? []).map((match) => ({
    name:
      typeof match.metadata?.metadata?.name === 'string' && match.metadata.metadata.name.trim()
        ? match.metadata.metadata.name
        : '(No name)',
    path_display:
      typeof match.metadata?.metadata?.path_display === 'string'
        ? match.metadata.metadata.path_display
        : '',
  }));
}
