import { IntegrationError } from './errors';

const STATUSPAGE_API_BASE_URL = 'https://api.statuspage.io/v1';

type StatuspagePage = {
  id?: string;
  name?: string;
  subdomain?: string;
  page_description?: string | null;
};

type StatuspageIncident = {
  id?: string;
  name?: string;
  status?: string;
  impact?: string;
  created_at?: string;
};

type StatuspageCreateIncidentResponse = {
  id?: string;
  name?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('StatuspageのAPI Keyが設定されていません。');
  }

  return trimmed;
}

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  const errors = (payload as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const firstError = errors[0];
    if (typeof firstError === 'string' && firstError.trim()) {
      return firstError;
    }
  }

  return null;
}

async function statuspageRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${STATUSPAGE_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `OAuth ${normalizeToken(token)}`,
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

export async function getPages(
  token: string
): Promise<Array<{ id: string; name: string; subdomain: string; page_description: string }>> {
  const response = await statuspageRequest<StatuspagePage[]>(
    '/pages',
    token,
    { method: 'GET' },
    'Statuspageのpage一覧取得に失敗しました。'
  );

  return response.map((page) => ({
    id: typeof page.id === 'string' ? page.id : '',
    name: typeof page.name === 'string' && page.name.trim() ? page.name : '(No name)',
    subdomain:
      typeof page.subdomain === 'string' && page.subdomain.trim() ? page.subdomain : '(No subdomain)',
    page_description:
      typeof page.page_description === 'string' && page.page_description.trim()
        ? page.page_description
        : '-',
  }));
}

export async function getIncidents(
  token: string,
  pageId: string
): Promise<Array<{ id: string; name: string; status: string; impact: string; created_at: string }>> {
  const normalizedPageId = pageId.trim();

  if (!normalizedPageId) {
    throw new IntegrationError('Statuspageのpage_idを指定してください。');
  }

  const response = await statuspageRequest<StatuspageIncident[]>(
    `/pages/${encodeURIComponent(normalizedPageId)}/incidents?limit=10`,
    token,
    { method: 'GET' },
    'Statuspageのincident一覧取得に失敗しました。'
  );

  return response.map((incident) => ({
    id: typeof incident.id === 'string' ? incident.id : '',
    name: typeof incident.name === 'string' && incident.name.trim() ? incident.name : '(No name)',
    status: typeof incident.status === 'string' && incident.status.trim() ? incident.status : 'unknown',
    impact: typeof incident.impact === 'string' && incident.impact.trim() ? incident.impact : 'unknown',
    created_at: typeof incident.created_at === 'string' ? incident.created_at : '',
  }));
}

export async function createIncident(
  token: string,
  pageId: string,
  name: string,
  status: string,
  impact: string,
  body: string
): Promise<{ id: string; name: string }> {
  const normalizedPageId = pageId.trim();
  const normalizedName = name.trim();
  const normalizedStatus = status.trim();
  const normalizedImpact = impact.trim();
  const normalizedBody = body.trim();

  if (!normalizedPageId || !normalizedName || !normalizedStatus || !normalizedImpact || !normalizedBody) {
    throw new IntegrationError('Statuspageのpage_id、name、status、impact、bodyを指定してください。');
  }

  const response = await statuspageRequest<StatuspageCreateIncidentResponse>(
    `/pages/${encodeURIComponent(normalizedPageId)}/incidents`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        incident: {
          name: normalizedName,
          status: normalizedStatus,
          impact_override: normalizedImpact,
          body: normalizedBody,
        },
      }),
    },
    'Statuspageのincident作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    name: typeof response.name === 'string' && response.name.trim() ? response.name : normalizedName,
  };
}
