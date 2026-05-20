import { IntegrationError } from './errors';

const DATADOG_API_BASE = 'https://api.datadoghq.com/api/v1';
const DATADOG_APP_BASE = 'https://app.datadoghq.com';

type DatadogMonitor = {
  id: number;
  name?: string | null;
  overall_state?: string | null;
  priority?: number | null;
  message?: string | null;
};

type DatadogQuerySeries = {
  metric?: string | null;
  pointlist?: Array<[number, number | null]> | null;
};

type DatadogQueryResponse = {
  series?: DatadogQuerySeries[];
};

type DatadogDashboard = {
  id?: string | null;
  title?: string | null;
  url?: string | null;
  popularity?: number | null;
};

type DatadogDashboardListResponse = {
  dashboards?: DatadogDashboard[];
};

type DatadogEventResponse = {
  status?: string;
  event?: unknown;
  errors?: string[];
};

function getHeaders(apiKey: string, appKey: string): Record<string, string> {
  const normalizedApiKey = apiKey.trim();
  const normalizedAppKey = appKey.trim();

  if (!normalizedApiKey || !normalizedAppKey) {
    throw new IntegrationError('DatadogのAPIキーまたはApplicationキーが設定されていません。');
  }

  return {
    'DD-API-KEY': normalizedApiKey,
    'DD-APPLICATION-KEY': normalizedAppKey,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function extractDatadogError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error;
  }

  const errors = record.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const firstError = errors[0];
    if (typeof firstError === 'string' && firstError.trim()) {
      return firstError;
    }
  }

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message;
  }

  return null;
}

async function datadogFetch<T>(
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
    const apiMessage = extractDatadogError(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function listAlerts(
  apiKey: string,
  appKey: string
): Promise<
  {
    id: number;
    name: string;
    status: string;
    priority: string;
    message: string;
    url: string;
  }[]
> {
  const monitors = await datadogFetch<DatadogMonitor[]>(
    `${DATADOG_API_BASE}/monitor?with_downtimes=false&page_size=20`,
    {
      method: 'GET',
      headers: getHeaders(apiKey, appKey),
    },
    'Datadogのmonitor一覧取得に失敗しました。'
  );

  return monitors.map((monitor) => ({
    id: monitor.id,
    name: monitor.name ?? '(No name)',
    status: monitor.overall_state ?? 'Unknown',
    priority: monitor.priority == null ? 'none' : String(monitor.priority),
    message: monitor.message ?? '',
    url: `${DATADOG_APP_BASE}/monitors/${monitor.id}`,
  }));
}

export async function getMetrics(
  apiKey: string,
  appKey: string,
  query: string,
  from?: number,
  to?: number
): Promise<{ series: { metric: string; pointlist: Array<[number, number | null]> }[] }> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new IntegrationError('Datadogのmetric queryを指定してください。');
  }

  const now = Math.floor(Date.now() / 1000);
  const fromTimestamp = from ?? now - 3600;
  const toTimestamp = to ?? now;
  const searchParams = new URLSearchParams({
    from: String(fromTimestamp),
    to: String(toTimestamp),
    query: trimmedQuery,
  });

  const response = await datadogFetch<DatadogQueryResponse>(
    `${DATADOG_API_BASE}/query?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: getHeaders(apiKey, appKey),
    },
    'Datadogのmetric queryに失敗しました。'
  );

  return {
    series: (response.series ?? []).map((series) => ({
      metric: series.metric ?? '(unknown metric)',
      pointlist: series.pointlist ?? [],
    })),
  };
}

export async function listDashboards(
  apiKey: string,
  appKey: string
): Promise<{ id: string; title: string; url: string; popularity: string }[]> {
  const response = await datadogFetch<DatadogDashboardListResponse>(
    `${DATADOG_API_BASE}/dashboard`,
    {
      method: 'GET',
      headers: getHeaders(apiKey, appKey),
    },
    'Datadogのdashboard一覧取得に失敗しました。'
  );

  return (response.dashboards ?? [])
    .filter((dashboard): dashboard is DatadogDashboard & { id: string } => typeof dashboard.id === 'string')
    .map((dashboard) => ({
      id: dashboard.id,
      title: dashboard.title ?? '(No title)',
      url: dashboard.url
        ? `${DATADOG_APP_BASE}${dashboard.url.startsWith('/') ? '' : '/'}${dashboard.url}`
        : `${DATADOG_APP_BASE}/dashboard/${dashboard.id}`,
      popularity: dashboard.popularity == null ? 'unknown' : String(dashboard.popularity),
    }));
}

export async function postEvent(
  apiKey: string,
  appKey: string,
  params: {
    title: string;
    text: string;
    priority?: 'normal' | 'low';
    tags?: string[];
  }
): Promise<{ status: string; event: unknown }> {
  const title = params.title.trim();
  const text = params.text.trim();

  if (!title || !text) {
    throw new IntegrationError('Datadog event の title と text を指定してください。');
  }

  const response = await datadogFetch<DatadogEventResponse>(
    `${DATADOG_API_BASE}/events`,
    {
      method: 'POST',
      headers: getHeaders(apiKey, appKey),
      body: JSON.stringify({
        title,
        text,
        priority: params.priority ?? 'normal',
        tags: params.tags ?? [],
      }),
    },
    'Datadog event の投稿に失敗しました。'
  );

  return {
    status: response.status ?? 'unknown',
    event: response.event ?? null,
  };
}
