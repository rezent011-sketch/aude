import { IntegrationError } from './errors';

const SMARTHR_BASE_DOMAIN = 'smarthr.jp';

type SmartHREmployee = Record<string, unknown>;
type SmartHRDepartment = Record<string, unknown>;

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('SmartHRのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeSubdomain(subdomain: string): string {
  const trimmed = subdomain.trim();

  if (!trimmed) {
    throw new IntegrationError('SmartHRのsubdomainを指定してください。');
  }

  return trimmed;
}

function buildSmartHRUrl(
  subdomain: string,
  path: string,
  searchParams?: URLSearchParams
): string {
  const url = new URL(`https://${normalizeSubdomain(subdomain)}.${SMARTHR_BASE_DOMAIN}/api/v1${path}`);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidateKeys = ['message', 'error', 'errors'] as const;

  for (const key of candidateKeys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function smartHRRequest<T>(
  token: string,
  subdomain: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string,
  searchParams?: URLSearchParams
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildSmartHRUrl(subdomain, path, searchParams), {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizeToken(token)}`,
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
    const apiMessage =
      typeof payload === 'string' && payload.trim() ? payload.trim() : extractErrorMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getEmployees(
  token: string,
  subdomain: string
): Promise<SmartHREmployee[]> {
  const searchParams = new URLSearchParams({
    per_page: '20',
  });

  const response = await smartHRRequest<unknown>(
    token,
    subdomain,
    '/employees',
    { method: 'GET' },
    'SmartHRのemployee一覧取得に失敗しました。',
    searchParams
  );

  if (!Array.isArray(response)) {
    throw new IntegrationError('SmartHR APIレスポンスの形式が不正です。');
  }

  return response as SmartHREmployee[];
}

export async function getEmployee(
  token: string,
  subdomain: string,
  id: string
): Promise<SmartHREmployee> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new IntegrationError('SmartHRのemployee IDを指定してください。');
  }

  const response = await smartHRRequest<unknown>(
    token,
    subdomain,
    `/employees/${encodeURIComponent(normalizedId)}`,
    { method: 'GET' },
    'SmartHRのemployee取得に失敗しました。'
  );

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new IntegrationError('SmartHR APIレスポンスの形式が不正です。');
  }

  return response as SmartHREmployee;
}

export async function getDepartments(
  token: string,
  subdomain: string
): Promise<SmartHRDepartment[]> {
  const response = await smartHRRequest<unknown>(
    token,
    subdomain,
    '/departments',
    { method: 'GET' },
    'SmartHRのdepartment一覧取得に失敗しました。'
  );

  if (!Array.isArray(response)) {
    throw new IntegrationError('SmartHR APIレスポンスの形式が不正です。');
  }

  return response as SmartHRDepartment[];
}
