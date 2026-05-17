import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

type GoogleTokenResponse = {
  access_token: string;
};

type GoogleDriveFileResponse = {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  createdTime?: string;
};

type GoogleDriveListResponse = {
  files?: GoogleDriveFileResponse[];
};

export type DriveFileSummary = {
  id: string;
  name: string;
  mimeType: string;
  url: string | null;
  createdTime: string | null;
};

export type DriveUploadResult = {
  id: string;
  name: string;
  mimeType: string;
  url: string | null;
};

async function getAccessToken(): Promise<string> {
  const clientId = requireEnvVar('GOOGLE_CLIENT_ID', 'Google Drive');
  const clientSecret = requireEnvVar('GOOGLE_CLIENT_SECRET', 'Google Drive');
  const refreshToken = requireEnvVar('GOOGLE_REFRESH_TOKEN', 'Google Drive');

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetchJson<GoogleTokenResponse>(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
    'Google Driveのアクセストークン取得に失敗しました。OAuth設定とリフレッシュトークンを確認してください。'
  );

  return response.access_token;
}

async function getHeaders(contentType?: string): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();

  return {
    Authorization: `Bearer ${accessToken}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

function mapDriveFile(file: GoogleDriveFileResponse): DriveFileSummary {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType ?? 'application/octet-stream',
    url: file.webViewLink ?? null,
    createdTime: file.createdTime ?? null,
  };
}

export async function listDriveFiles(): Promise<DriveFileSummary[]> {
  const params = new URLSearchParams({
    pageSize: '10',
    fields: 'files(id,name,mimeType,webViewLink,createdTime)',
    orderBy: 'modifiedTime desc',
  });

  const response = await fetchJson<GoogleDriveListResponse>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      method: 'GET',
      headers: await getHeaders(),
    },
    'Google Driveファイル一覧の取得に失敗しました。Drive API の有効化と権限を確認してください。'
  );

  return (response.files ?? []).map(mapDriveFile);
}

export async function searchDriveFiles(query: string): Promise<DriveFileSummary[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new IntegrationError('Google Drive検索キーワードを入力してください。');
  }

  const params = new URLSearchParams({
    q: `name contains '${trimmedQuery.replace(/'/g, "\\'")}' and trashed = false`,
    pageSize: '10',
    fields: 'files(id,name,mimeType,webViewLink,createdTime)',
    orderBy: 'modifiedTime desc',
  });

  const response = await fetchJson<GoogleDriveListResponse>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      method: 'GET',
      headers: await getHeaders(),
    },
    'Google Drive検索に失敗しました。Drive API の有効化と権限を確認してください。'
  );

  return (response.files ?? []).map(mapDriveFile);
}

export async function uploadDriveFile(
  name: string,
  content: string,
  mimeType = 'text/plain'
): Promise<DriveUploadResult> {
  const trimmedName = name.trim();
  const normalizedContent = content.trim();
  const trimmedMimeType = mimeType.trim() || 'text/plain';

  if (!trimmedName) {
    throw new IntegrationError('アップロードするファイル名を入力してください。');
  }

  if (!normalizedContent) {
    throw new IntegrationError('アップロードするファイル内容を入力してください。');
  }

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify({ name: trimmedName, mimeType: trimmedMimeType })], {
      type: 'application/json',
    })
  );
  formData.append('file', new Blob([normalizedContent], { type: trimmedMimeType }), trimmedName);

  const response = await fetchJson<GoogleDriveFileResponse>(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: await getHeaders(),
      body: formData,
    },
    'Google Driveへのアップロードに失敗しました。Drive API の有効化と権限を確認してください。'
  );

  return {
    id: response.id,
    name: response.name,
    mimeType: response.mimeType ?? trimmedMimeType,
    url: response.webViewLink ?? null,
  };
}
