import { IntegrationError } from './errors';

const RAKUMO_API_BASE_URL = 'https://a.rakumo.com/api/v2';

type RakumoEventsResponse = {
  events?: Array<{
    id?: string;
    summary?: string;
    start?: {
      dateTime?: string;
    };
    end?: {
      dateTime?: string;
    };
    organizer?: {
      displayName?: string;
    };
  }>;
};

type RakumoEventResponse = {
  event?: {
    id?: string;
    summary?: string;
  };
};

type RakumoContactsResponse = {
  contacts?: Array<{
    id?: string;
    displayName?: string;
    email?: string;
    organization?: string;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('RakumoのAPIトークンが設定されていません。');
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function rakumoRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${RAKUMO_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json',
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
    const apiMessage = extractMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getCalendarEvents(
  token: string,
  start: string,
  end: string
): Promise<Array<{ id: string; title: string; start: string; end: string; organizer: string }>> {
  const normalizedStart = start.trim();
  const normalizedEnd = end.trim();

  if (!normalizedStart) {
    throw new IntegrationError('Rakumoのstartを指定してください。');
  }

  if (!normalizedEnd) {
    throw new IntegrationError('Rakumoのendを指定してください。');
  }

  const searchParams = new URLSearchParams({
    start: normalizedStart,
    end: normalizedEnd,
  });

  const response = await rakumoRequest<RakumoEventsResponse>(
    `/calendar/events?${searchParams.toString()}`,
    token,
    { method: 'GET' },
    'Rakumoのカレンダーイベント一覧取得に失敗しました。'
  );

  return (response.events ?? []).map((event) => ({
    id: typeof event.id === 'string' ? event.id : '',
    title: typeof event.summary === 'string' && event.summary.trim() ? event.summary : '(No title)',
    start: typeof event.start?.dateTime === 'string' ? event.start.dateTime : '',
    end: typeof event.end?.dateTime === 'string' ? event.end.dateTime : '',
    organizer:
      typeof event.organizer?.displayName === 'string' && event.organizer.displayName.trim()
        ? event.organizer.displayName
        : '(No organizer)',
  }));
}

export async function createCalendarEvent(
  token: string,
  title: string,
  start: string,
  end: string,
  attendees?: string[]
): Promise<{ id: string; title: string }> {
  const normalizedTitle = title.trim();
  const normalizedStart = start.trim();
  const normalizedEnd = end.trim();

  if (!normalizedTitle) {
    throw new IntegrationError('Rakumoのtitleを指定してください。');
  }

  if (!normalizedStart) {
    throw new IntegrationError('Rakumoのstartを指定してください。');
  }

  if (!normalizedEnd) {
    throw new IntegrationError('Rakumoのendを指定してください。');
  }

  const normalizedAttendees = (attendees ?? [])
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  const response = await rakumoRequest<RakumoEventResponse>(
    '/calendar/events',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        summary: normalizedTitle,
        start: { dateTime: normalizedStart },
        end: { dateTime: normalizedEnd },
        attendees: normalizedAttendees.map((email) => ({ email })),
      }),
    },
    'Rakumoのカレンダーイベント作成に失敗しました。'
  );

  return {
    id: typeof response.event?.id === 'string' ? response.event.id : '',
    title:
      typeof response.event?.summary === 'string' && response.event.summary.trim()
        ? response.event.summary
        : normalizedTitle,
  };
}

export async function getContacts(
  token: string,
  keyword?: string
): Promise<Array<{ id: string; name: string; email: string; company: string }>> {
  const normalizedKeyword = keyword?.trim();
  const searchParams = new URLSearchParams();

  if (normalizedKeyword) {
    searchParams.set('keyword', normalizedKeyword);
  }

  const path = searchParams.size > 0 ? `/contacts?${searchParams.toString()}` : '/contacts';
  const response = await rakumoRequest<RakumoContactsResponse>(
    path,
    token,
    { method: 'GET' },
    'Rakumoのコンタクト一覧取得に失敗しました。'
  );

  return (response.contacts ?? []).map((contact) => ({
    id: typeof contact.id === 'string' ? contact.id : '',
    name:
      typeof contact.displayName === 'string' && contact.displayName.trim()
        ? contact.displayName
        : '(No name)',
    email: typeof contact.email === 'string' ? contact.email : '',
    company:
      typeof contact.organization === 'string' && contact.organization.trim()
        ? contact.organization
        : '',
  }));
}
