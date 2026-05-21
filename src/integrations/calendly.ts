import { IntegrationError } from './errors';

const CALENDLY_API_BASE_URL = 'https://api.calendly.com';

type CalendlyCurrentUserResponse = {
  resource?: {
    uri?: string;
    name?: string;
    email?: string;
    scheduling_url?: string;
  };
};

type CalendlyEventTypesResponse = {
  collection?: Array<{
    uri?: string;
    name?: string;
    duration?: number;
    scheduling_url?: string;
    active?: boolean;
  }>;
};

type CalendlyScheduledEventsResponse = {
  collection?: Array<{
    uri?: string;
    name?: string;
    start_time?: string;
    end_time?: string;
    status?: string;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Calendlyのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const title = (payload as { title?: unknown }).title;
  if (typeof title === 'string' && title.trim()) {
    return title;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function calendlyRequest<T>(path: string, token: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${CALENDLY_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json',
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
    const apiMessage = extractMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getCurrentUser(
  token: string
): Promise<{ uri: string; name: string; email: string; scheduling_url: string }> {
  const response = await calendlyRequest<CalendlyCurrentUserResponse>(
    '/users/me',
    token,
    'Calendlyの現在ユーザー取得に失敗しました。'
  );

  return {
    uri: typeof response.resource?.uri === 'string' ? response.resource.uri : '',
    name: typeof response.resource?.name === 'string' ? response.resource.name : '',
    email: typeof response.resource?.email === 'string' ? response.resource.email : '',
    scheduling_url:
      typeof response.resource?.scheduling_url === 'string' ? response.resource.scheduling_url : '',
  };
}

export async function getEventTypes(
  token: string,
  userUri: string
): Promise<
  Array<{
    uri: string;
    name: string;
    duration: number;
    scheduling_url: string;
    active: boolean;
  }>
> {
  const normalizedUserUri = userUri.trim();

  if (!normalizedUserUri) {
    throw new IntegrationError('Calendlyのuser URIを指定してください。');
  }

  const response = await calendlyRequest<CalendlyEventTypesResponse>(
    `/event_types?user=${encodeURIComponent(normalizedUserUri)}`,
    token,
    'Calendlyのイベントタイプ一覧取得に失敗しました。'
  );

  return (response.collection ?? []).map((eventType) => ({
    uri: typeof eventType.uri === 'string' ? eventType.uri : '',
    name: typeof eventType.name === 'string' && eventType.name.trim() ? eventType.name : '(No name)',
    duration: typeof eventType.duration === 'number' ? eventType.duration : 0,
    scheduling_url:
      typeof eventType.scheduling_url === 'string' ? eventType.scheduling_url : '',
    active: eventType.active === true,
  }));
}

export async function getScheduledEvents(
  token: string,
  userUri: string
): Promise<
  Array<{
    uri: string;
    name: string;
    start_time: string;
    end_time: string;
    status: string;
  }>
> {
  const normalizedUserUri = userUri.trim();

  if (!normalizedUserUri) {
    throw new IntegrationError('Calendlyのuser URIを指定してください。');
  }

  const response = await calendlyRequest<CalendlyScheduledEventsResponse>(
    `/scheduled_events?user=${encodeURIComponent(normalizedUserUri)}&sort=start_time:asc&count=10`,
    token,
    'Calendlyの予約済みイベント一覧取得に失敗しました。'
  );

  return (response.collection ?? []).map((event) => ({
    uri: typeof event.uri === 'string' ? event.uri : '',
    name: typeof event.name === 'string' && event.name.trim() ? event.name : '(No name)',
    start_time: typeof event.start_time === 'string' ? event.start_time : '',
    end_time: typeof event.end_time === 'string' ? event.end_time : '',
    status: typeof event.status === 'string' && event.status.trim() ? event.status : 'unknown',
  }));
}
