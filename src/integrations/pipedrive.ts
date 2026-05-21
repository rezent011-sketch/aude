import { IntegrationError } from './errors';

const PIPEDRIVE_API_BASE_URL = 'https://api.pipedrive.com/v1';

type PipedriveDealRecord = {
  id?: number;
  title?: string;
  status?: string;
  value?: number;
  currency?: string;
  org_name?: string;
};

type PipedriveDealsResponse = {
  data?: PipedriveDealRecord[];
};

type PipedrivePersonValue = {
  value?: string;
};

type PipedrivePersonRecord = {
  id?: number;
  name?: string;
  email?: PipedrivePersonValue[];
  phone?: PipedrivePersonValue[];
  org_name?: string;
};

type PipedrivePersonsResponse = {
  data?: PipedrivePersonRecord[];
};

type PipedriveCreateDealResponse = {
  data?: {
    id?: number;
    title?: string;
  };
};

function normalizeToken(token: string): string {
  const normalized = token.trim();

  if (!normalized) {
    throw new IntegrationError('PipedriveのAPI tokenが設定されていません。');
  }

  return normalized;
}

function normalizeLimit(limit?: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 20;
  }

  return Math.max(1, Math.min(Math.trunc(limit), 100));
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();

  if (!normalized) {
    throw new IntegrationError('Pipedriveのtitleを指定してください。');
  }

  return normalized;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return null;
}

async function pipedriveRequest<T>(
  token: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      `${PIPEDRIVE_API_BASE_URL}${path}${path.includes('?') ? '&' : '?'}api_token=${encodeURIComponent(normalizeToken(token))}`,
      {
        ...init,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(init.headers ?? {}),
        },
      }
    );
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractMessage(payload);
    throw new IntegrationError(
      apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage
    );
  }

  return payload as T;
}

export async function getDeals(
  token: string,
  limit?: number
): Promise<
  Array<{
    id: number;
    title: string;
    status: string;
    value: number;
    currency: string;
    org_name: string;
  }>
> {
  const response = await pipedriveRequest<PipedriveDealsResponse>(
    token,
    `/deals?limit=${normalizeLimit(limit)}`,
    {
      method: 'GET',
    },
    'Pipedriveの案件一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((deal) => ({
    id: typeof deal.id === 'number' ? deal.id : 0,
    title: typeof deal.title === 'string' ? deal.title : '',
    status: typeof deal.status === 'string' ? deal.status : '',
    value: typeof deal.value === 'number' ? deal.value : 0,
    currency: typeof deal.currency === 'string' ? deal.currency : '',
    org_name: typeof deal.org_name === 'string' ? deal.org_name : '',
  }));
}

export async function getPersons(
  token: string,
  limit?: number
): Promise<
  Array<{
    id: number;
    name: string;
    email: string;
    phone: string;
    org_name: string;
  }>
> {
  const response = await pipedriveRequest<PipedrivePersonsResponse>(
    token,
    `/persons?limit=${normalizeLimit(limit)}`,
    {
      method: 'GET',
    },
    'Pipedriveの連絡先一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((person) => ({
    id: typeof person.id === 'number' ? person.id : 0,
    name: typeof person.name === 'string' ? person.name : '',
    email: typeof person.email?.[0]?.value === 'string' ? person.email[0].value : '',
    phone: typeof person.phone?.[0]?.value === 'string' ? person.phone[0].value : '',
    org_name: typeof person.org_name === 'string' ? person.org_name : '',
  }));
}

export async function createDeal(
  token: string,
  title: string,
  value?: number
): Promise<{ id: number; title: string }> {
  const normalizedTitle = normalizeTitle(title);
  const response = await pipedriveRequest<PipedriveCreateDealResponse>(
    token,
    '/deals',
    {
      method: 'POST',
      body: JSON.stringify({
        title: normalizedTitle,
        value: typeof value === 'number' && Number.isFinite(value) ? value : 0,
      }),
    },
    'Pipedriveの案件作成に失敗しました。'
  );

  return {
    id: typeof response.data?.id === 'number' ? response.data.id : 0,
    title:
      typeof response.data?.title === 'string' && response.data.title.trim()
        ? response.data.title
        : normalizedTitle,
  };
}
