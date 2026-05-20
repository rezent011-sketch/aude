import { IntegrationError } from './errors';

const KINTONE_BASE_DOMAIN = 'cybozu.com';

type KintoneFieldValue = { value: unknown };

type KintoneRecord = Record<string, KintoneFieldValue>;

type KintoneRecordsResponse = {
  records?: KintoneRecord[];
  totalCount?: string;
  message?: string;
};

type KintoneRecordResponse = {
  id?: string;
  revision?: string;
  message?: string;
};

type KintoneAppsResponse = {
  apps?: Array<{
    appId?: string;
    name?: string;
    description?: string | null;
  }>;
  message?: string;
};

function normalizeSubdomain(subdomain: string): string {
  const trimmed = subdomain.trim();

  if (!trimmed) {
    throw new IntegrationError('kintoneのsubdomainを指定してください。');
  }

  return trimmed;
}

function normalizeApiToken(apiToken: string): string {
  const trimmed = apiToken.trim();

  if (!trimmed) {
    throw new IntegrationError('kintoneのAPI tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeAppId(appId: number): number {
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new IntegrationError('kintoneのapp IDは正の整数で指定してください。');
  }

  return appId;
}

function buildKintoneUrl(subdomain: string, path: string, searchParams?: URLSearchParams): string {
  const url = new URL(`https://${normalizeSubdomain(subdomain)}.${KINTONE_BASE_DOMAIN}/k/v1${path}`);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
}

function extractKintoneMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function kintoneRequest<T>(
  subdomain: string,
  apiToken: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string,
  searchParams?: URLSearchParams
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildKintoneUrl(subdomain, path, searchParams), {
      ...init,
      headers: {
        Accept: 'application/json',
        'X-Cybozu-API-Token': normalizeApiToken(apiToken),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const apiMessage = extractKintoneMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getRecords(
  subdomain: string,
  apiToken: string,
  appId: number,
  query?: string
): Promise<{ records: Record<string, { value: unknown }>[], totalCount: string }> {
  const searchParams = new URLSearchParams({
    app: String(normalizeAppId(appId)),
    totalCount: 'true',
  });

  if (query?.trim()) {
    searchParams.set('query', query.trim());
  }

  const response = await kintoneRequest<KintoneRecordsResponse>(
    subdomain,
    apiToken,
    '/records.json',
    { method: 'GET' },
    'kintoneのrecord一覧取得に失敗しました。',
    searchParams
  );

  return {
    records: Array.isArray(response.records) ? response.records : [],
    totalCount: typeof response.totalCount === 'string' ? response.totalCount : '0',
  };
}

export async function createRecord(
  subdomain: string,
  apiToken: string,
  appId: number,
  record: Record<string, { value: unknown }>
): Promise<{ id: string }> {
  const response = await kintoneRequest<KintoneRecordResponse>(
    subdomain,
    apiToken,
    '/record.json',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app: normalizeAppId(appId),
        record,
      }),
    },
    'kintoneのrecord作成に失敗しました。'
  );

  if (typeof response.id !== 'string' || !response.id.trim()) {
    throw new IntegrationError('kintone APIレスポンスの形式が不正です。');
  }

  return { id: response.id };
}

export async function updateRecord(
  subdomain: string,
  apiToken: string,
  appId: number,
  id: number,
  record: Record<string, { value: unknown }>
): Promise<{ revision: string }> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new IntegrationError('kintoneのrecord IDは正の整数で指定してください。');
  }

  const response = await kintoneRequest<KintoneRecordResponse>(
    subdomain,
    apiToken,
    '/record.json',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app: normalizeAppId(appId),
        id,
        record,
      }),
    },
    'kintoneのrecord更新に失敗しました。'
  );

  if (typeof response.revision !== 'string' || !response.revision.trim()) {
    throw new IntegrationError('kintone APIレスポンスの形式が不正です。');
  }

  return { revision: response.revision };
}

export async function getApps(
  subdomain: string,
  apiToken: string
): Promise<{ appId: string; name: string; description: string }[]> {
  const response = await kintoneRequest<KintoneAppsResponse>(
    subdomain,
    apiToken,
    '/apps.json',
    { method: 'GET' },
    'kintoneのapp一覧取得に失敗しました。'
  );

  return (response.apps ?? []).map((app) => ({
    appId: typeof app.appId === 'string' ? app.appId : '',
    name: typeof app.name === 'string' && app.name.trim() ? app.name : '(No name)',
    description:
      typeof app.description === 'string' && app.description.trim()
        ? app.description
        : '説明なし',
  }));
}

function escapeKintoneQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function searchRecords(
  subdomain: string,
  apiToken: string,
  appId: number,
  searchField: string,
  searchValue: string
): Promise<Record<string, { value: unknown }>[]> {
  const field = searchField.trim();
  const value = searchValue.trim();

  if (!field || !value) {
    throw new IntegrationError('kintoneの検索には field と value の両方が必要です。');
  }

  const result = await getRecords(
    subdomain,
    apiToken,
    appId,
    `${field} like "${escapeKintoneQueryValue(value)}"`
  );

  return result.records;
}
