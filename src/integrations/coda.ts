import { IntegrationError } from './errors';
import { fetchJson } from './http';

const CODA_API_BASE_URL = 'https://coda.io/apis/v1';

type CodaDocItem = {
  id?: string;
  name?: string;
  owner?: string;
  createdAt?: string;
};

type CodaTableItem = {
  id?: string;
  name?: string;
  rowCount?: number;
};

type CodaRowItem = {
  id?: string;
  name?: string;
  values?: Record<string, unknown>;
};

type CodaDocsResponse = {
  items?: CodaDocItem[];
};

type CodaTablesResponse = {
  items?: CodaTableItem[];
};

type CodaRowsResponse = {
  items?: CodaRowItem[];
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Coda APIトークンが設定されていません。');
  }

  return trimmed;
}

function normalizeId(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Codaの${label}を指定してください。`);
  }

  return trimmed;
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeToken(token)}`,
    Accept: 'application/json',
  };
}

export async function listDocs(
  token: string
): Promise<Array<{ id: string; name: string; owner: string; createdAt: string }>> {
  const response = await fetchJson<CodaDocsResponse>(
    `${CODA_API_BASE_URL}/docs?limit=20`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Codaのドキュメント一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((doc) => ({
    id: typeof doc.id === 'string' ? doc.id : '',
    name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : '(No name)',
    owner: typeof doc.owner === 'string' ? doc.owner : '',
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : '',
  }));
}

export async function listTables(
  token: string,
  docId: string
): Promise<Array<{ id: string; name: string; rowCount: number }>> {
  const normalizedDocId = normalizeId(docId, 'doc_id');
  const response = await fetchJson<CodaTablesResponse>(
    `${CODA_API_BASE_URL}/docs/${encodeURIComponent(normalizedDocId)}/tables?limit=20`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Codaのテーブル一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((table) => ({
    id: typeof table.id === 'string' ? table.id : '',
    name: typeof table.name === 'string' && table.name.trim() ? table.name : '(No name)',
    rowCount: typeof table.rowCount === 'number' ? table.rowCount : 0,
  }));
}

export async function listRows(
  token: string,
  docId: string,
  tableId: string
): Promise<Array<{ id: string; name: string; values: Record<string, unknown> }>> {
  const normalizedDocId = normalizeId(docId, 'doc_id');
  const normalizedTableId = normalizeId(tableId, 'table_id');
  const response = await fetchJson<CodaRowsResponse>(
    `${CODA_API_BASE_URL}/docs/${encodeURIComponent(normalizedDocId)}/tables/${encodeURIComponent(normalizedTableId)}/rows?limit=20`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Codaの行一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((row) => ({
    id: typeof row.id === 'string' ? row.id : '',
    name: typeof row.name === 'string' && row.name.trim() ? row.name : '(No name)',
    values: row.values && typeof row.values === 'object' ? row.values : {},
  }));
}
