import { IntegrationError } from './errors';

const PAGERDUTY_API_BASE = 'https://api.pagerduty.com';
const PAGERDUTY_EVENTS_API_BASE = 'https://events.pagerduty.com';

type PagerDutyIncident = {
  id: string;
  title?: string | null;
  status?: string | null;
  urgency?: string | null;
  created_at?: string | null;
  html_url?: string | null;
  service?: {
    summary?: string | null;
  } | null;
  body?: {
    details?: string | null;
  } | null;
};

type PagerDutyIncidentListResponse = {
  incidents?: PagerDutyIncident[];
};

type PagerDutyIncidentResponse = {
  incident?: PagerDutyIncident;
};

type PagerDutyService = {
  id: string;
  name?: string | null;
  status?: string | null;
  html_url?: string | null;
};

type PagerDutyServiceListResponse = {
  services?: PagerDutyService[];
};

type PagerDutyTriggerResponse = {
  status?: string;
  message?: string;
  dedup_key?: string;
};

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('PagerDutyのAPIキーが設定されていません。');
  }

  return trimmed;
}

function getHeaders(apiKey: string, extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Token token=${normalizeApiKey(apiKey)}`,
    Accept: 'application/vnd.pagerduty+json;version=2',
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message;
  }

  const error = record.error;

  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;

    if (typeof errorRecord.message === 'string' && errorRecord.message.trim()) {
      return errorRecord.message;
    }

    const errors = errorRecord.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const firstError = errors[0];
      if (typeof firstError === 'string' && firstError.trim()) {
        return firstError;
      }
    }
  }

  return null;
}

async function pagerDutyFetch<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const apiMessage = extractApiError(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

function mapIncident(incident: PagerDutyIncident) {
  return {
    id: incident.id,
    title: incident.title ?? '(No title)',
    status: incident.status ?? 'unknown',
    urgency: incident.urgency ?? 'unknown',
    service: incident.service?.summary ?? 'Unknown service',
    created_at: incident.created_at ?? '',
    html_url: incident.html_url ?? '',
  };
}

export async function listIncidents(
  apiKey: string,
  statuses: string[] = ['triggered', 'acknowledged']
): Promise<
  {
    id: string;
    title: string;
    status: string;
    urgency: string;
    service: string;
    created_at: string;
    html_url: string;
  }[]
> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', '10');

  for (const status of statuses) {
    const trimmed = status.trim();
    if (trimmed) {
      searchParams.append('statuses[]', trimmed);
    }
  }

  const response = await pagerDutyFetch<PagerDutyIncidentListResponse>(
    `${PAGERDUTY_API_BASE}/incidents?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: getHeaders(apiKey),
    },
    'PagerDutyのincident一覧取得に失敗しました。'
  );

  return (response.incidents ?? []).map(mapIncident);
}

export async function getIncident(
  apiKey: string,
  incidentId: string
): Promise<{
  id: string;
  title: string;
  status: string;
  urgency: string;
  body: string;
  service: string;
  html_url: string;
}> {
  const trimmedIncidentId = incidentId.trim();

  if (!trimmedIncidentId) {
    throw new IntegrationError('PagerDutyのincident IDを指定してください。');
  }

  const response = await pagerDutyFetch<PagerDutyIncidentResponse>(
    `${PAGERDUTY_API_BASE}/incidents/${encodeURIComponent(trimmedIncidentId)}`,
    {
      method: 'GET',
      headers: getHeaders(apiKey),
    },
    'PagerDutyのincident取得に失敗しました。'
  );

  const incident = response.incident;

  if (!incident) {
    throw new IntegrationError('PagerDutyのincidentが見つかりませんでした。');
  }

  return {
    id: incident.id,
    title: incident.title ?? '(No title)',
    status: incident.status ?? 'unknown',
    urgency: incident.urgency ?? 'unknown',
    body: incident.body?.details ?? '',
    service: incident.service?.summary ?? 'Unknown service',
    html_url: incident.html_url ?? '',
  };
}

async function updateIncidentStatus(
  apiKey: string,
  incidentId: string,
  email: string,
  status: 'acknowledged' | 'resolved'
): Promise<{ id: string; status: string }> {
  const trimmedIncidentId = incidentId.trim();
  const trimmedEmail = email.trim();

  if (!trimmedIncidentId) {
    throw new IntegrationError('PagerDutyのincident IDを指定してください。');
  }

  if (!trimmedEmail) {
    throw new IntegrationError('PagerDutyのemailが設定されていません。');
  }

  const response = await pagerDutyFetch<PagerDutyIncidentResponse>(
    `${PAGERDUTY_API_BASE}/incidents/${encodeURIComponent(trimmedIncidentId)}`,
    {
      method: 'PUT',
      headers: getHeaders(apiKey, {
        From: trimmedEmail,
      }),
      body: JSON.stringify({
        incident: {
          type: 'incident',
          status,
        },
      }),
    },
    `PagerDutyのincidentを${status === 'acknowledged' ? 'acknowledge' : 'resolve'}できませんでした。`
  );

  const incident = response.incident;

  if (!incident) {
    throw new IntegrationError('PagerDutyのincident更新結果を取得できませんでした。');
  }

  return {
    id: incident.id,
    status: incident.status ?? status,
  };
}

export async function acknowledgeIncident(
  apiKey: string,
  incidentId: string,
  email: string
): Promise<{ id: string; status: string }> {
  return updateIncidentStatus(apiKey, incidentId, email, 'acknowledged');
}

export async function resolveIncident(
  apiKey: string,
  incidentId: string,
  email: string
): Promise<{ id: string; status: string }> {
  return updateIncidentStatus(apiKey, incidentId, email, 'resolved');
}

export async function listServices(
  apiKey: string
): Promise<{ id: string; name: string; status: string; html_url: string }[]> {
  const response = await pagerDutyFetch<PagerDutyServiceListResponse>(
    `${PAGERDUTY_API_BASE}/services?limit=20`,
    {
      method: 'GET',
      headers: getHeaders(apiKey),
    },
    'PagerDutyのservice一覧取得に失敗しました。'
  );

  return (response.services ?? []).map((service) => ({
    id: service.id,
    name: service.name ?? '(No name)',
    status: service.status ?? 'unknown',
    html_url: service.html_url ?? '',
  }));
}

export async function triggerAlert(
  apiKey: string,
  routingKey: string,
  summary: string,
  severity: 'critical' | 'error' | 'warning' | 'info'
): Promise<{ status: string; message: string; dedup_key: string }> {
  const trimmedRoutingKey = routingKey.trim();
  const trimmedSummary = summary.trim();

  if (!trimmedRoutingKey) {
    throw new IntegrationError('PagerDutyのrouting keyが設定されていません。');
  }

  if (!trimmedSummary) {
    throw new IntegrationError('PagerDutyのalert summaryを指定してください。');
  }

  const response = await pagerDutyFetch<PagerDutyTriggerResponse>(
    `${PAGERDUTY_EVENTS_API_BASE}/v2/enqueue`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        routing_key: trimmedRoutingKey,
        event_action: 'trigger',
        payload: {
          summary: trimmedSummary,
          severity,
          source: 'Aude AI',
        },
      }),
    },
    'PagerDutyのalert triggerに失敗しました。'
  );

  return {
    status: response.status ?? 'unknown',
    message: response.message ?? '',
    dedup_key: response.dedup_key ?? '',
  };
}
