import { IntegrationError } from './errors';

const AIRTABLE_API_BASE_URL = 'https://api.airtable.com/v0';

type AirtableBasesResponse = {
  bases?: Array<{
    id?: string;
    name?: string;
    permissionLevel?: string;
  }>;
};

type AirtableRecordsResponse = {
  records?: Array<{
    id?: string;
    fields?: Record<string, unknown>;
    createdTime?: string;
  }>;
};

type AirtableRecordResponse = {
  id?: string;
  fields?: Record<string, unknown>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Airtable APIトークンが設定されていません。');
  }

  return trimmed;
}

function normalizeRequired(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Airtableの${label}を指定してください。`);
  }

  return trimmed;
}

async function airtableRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${AIRTABLE_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;

  if (!response.ok) {
    const apiMessage = payload?.error?.message;
    throw new IntegrationError(
      typeof apiMessage === 'string' && apiMessage.trim()
        ? `${fallbackMessage} (${apiMessage})`
        : fallbackMessage
    );
  }

  return payload as T;
}

export async function listBases(
  token: string
): Promise<Array<{ id: string; name: string; permissionLevel: string }>> {
  const response = await airtableRequest<AirtableBasesResponse>(
    '/meta/bases',
    token,
    { method: 'GET' },
    'Airtableのベース一覧取得に失敗しました。'
  );

  return (response.bases ?? []).map((base) => ({
    id: typeof base.id === 'string' ? base.id : '',
    name: typeof base.name === 'string' && base.name.trim() ? base.name : '(No name)',
    permissionLevel:
      typeof base.permissionLevel === 'string' && base.permissionLevel.trim()
        ? base.permissionLevel
        : '-',
  }));
}

export async function listRecords(
  token: string,
  baseId: string,
  tableId: string,
  maxRecords?: number
): Promise<Array<{ id: string; fields: Record<string, unknown>; createdTime: string }>> {
  const normalizedBaseId = normalizeRequired(baseId, 'base_id');
  const normalizedTableId = normalizeRequired(tableId, 'table');
  const limit = typeof maxRecords === 'number' && Number.isFinite(maxRecords) ? maxRecords : 20;
  const params = new URLSearchParams({ maxRecords: String(limit) });

  const response = await airtableRequest<AirtableRecordsResponse>(
    `/${encodeURIComponent(normalizedBaseId)}/${encodeURIComponent(normalizedTableId)}?${params.toString()}`,
    token,
    { method: 'GET' },
    'Airtableのレコード一覧取得に失敗しました。'
  );

  return (response.records ?? []).map((record) => ({
    id: typeof record.id === 'string' ? record.id : '',
    fields: record.fields && typeof record.fields === 'object' ? record.fields : {},
    createdTime: typeof record.createdTime === 'string' ? record.createdTime : '',
  }));
}

export async function createRecord(
  token: string,
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>
): Promise<{ id: string; fields: Record<string, unknown> }> {
  const normalizedBaseId = normalizeRequired(baseId, 'base_id');
  const normalizedTableId = normalizeRequired(tableId, 'table');

  const response = await airtableRequest<AirtableRecordResponse>(
    `/${encodeURIComponent(normalizedBaseId)}/${encodeURIComponent(normalizedTableId)}`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    },
    'Airtableのレコード作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    fields: response.fields && typeof response.fields === 'object' ? response.fields : {},
  };
}
