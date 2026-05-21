import { IntegrationError } from './errors';

const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';

type CloudflareZoneListResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    id?: string;
    name?: string;
    status?: string;
    plan?: {
      name?: string;
    } | null;
  }>;
};

type CloudflareDnsRecordListResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    id?: string;
    type?: string;
    name?: string;
    content?: string;
    ttl?: number;
  }>;
};

type CloudflarePurgeResponse = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: {
    id?: string;
  } | null;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('CloudflareのAPI Tokenが設定されていません。');
  }

  return trimmed;
}

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const errors = (payload as { errors?: Array<{ message?: unknown }> }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const message = errors[0]?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  const messages = (payload as { messages?: Array<{ message?: unknown }> }).messages;
  if (Array.isArray(messages) && messages.length > 0) {
    const message = messages[0]?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return null;
}

async function cloudflareRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${CLOUDFLARE_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractApiError(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getZones(
  token: string
): Promise<Array<{ id: string; name: string; status: string; plan: string }>> {
  const response = await cloudflareRequest<CloudflareZoneListResponse>(
    '/zones?per_page=20',
    token,
    { method: 'GET' },
    'Cloudflareのzone一覧取得に失敗しました。'
  );

  return (response.result ?? []).map((zone) => ({
    id: typeof zone.id === 'string' ? zone.id : '',
    name: typeof zone.name === 'string' && zone.name.trim() ? zone.name : '(No name)',
    status: typeof zone.status === 'string' && zone.status.trim() ? zone.status : 'unknown',
    plan: typeof zone.plan?.name === 'string' && zone.plan.name.trim() ? zone.plan.name : '-',
  }));
}

export async function getDnsRecords(
  token: string,
  zoneId: string
): Promise<Array<{ id: string; type: string; name: string; content: string; ttl: number }>> {
  const normalizedZoneId = zoneId.trim();

  if (!normalizedZoneId) {
    throw new IntegrationError('Cloudflareのzone_idを指定してください。');
  }

  const response = await cloudflareRequest<CloudflareDnsRecordListResponse>(
    `/zones/${encodeURIComponent(normalizedZoneId)}/dns_records`,
    token,
    { method: 'GET' },
    'CloudflareのDNS record一覧取得に失敗しました。'
  );

  return (response.result ?? []).map((record) => ({
    id: typeof record.id === 'string' ? record.id : '',
    type: typeof record.type === 'string' && record.type.trim() ? record.type : 'unknown',
    name: typeof record.name === 'string' && record.name.trim() ? record.name : '(No name)',
    content: typeof record.content === 'string' ? record.content : '',
    ttl: typeof record.ttl === 'number' ? record.ttl : 0,
  }));
}

export async function purgeCache(token: string, zoneId: string): Promise<{ id: string }> {
  const normalizedZoneId = zoneId.trim();

  if (!normalizedZoneId) {
    throw new IntegrationError('Cloudflareのzone_idを指定してください。');
  }

  const response = await cloudflareRequest<CloudflarePurgeResponse>(
    `/zones/${encodeURIComponent(normalizedZoneId)}/purge_cache`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        purge_everything: true,
      }),
    },
    'Cloudflareのキャッシュ削除に失敗しました。'
  );

  return {
    id: typeof response.result?.id === 'string' ? response.result.id : '',
  };
}
