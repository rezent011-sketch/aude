import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

const DEFAULT_TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE ?? 'Asia/Tokyo';
const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;
const DEFAULT_CALENDAR_ID = 'primary';

type GoogleTokenResponse = {
  access_token: string;
};

type GoogleCalendarDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleCalendarEventResponse = {
  id: string;
  summary?: string;
  htmlLink?: string;
  status?: string;
  start?: GoogleCalendarDateTime;
  end?: GoogleCalendarDateTime;
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEventResponse[];
};

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  url: string | null;
  start: string | null;
  end: string | null;
  isAllDay: boolean;
};

export type CreatedGoogleCalendarEvent = {
  id: string;
  title: string;
  url: string | null;
  start: string;
  end: string;
};

export type GoogleCalendarListOptions = {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  query?: string;
};

export type GoogleCalendarCreateInput = {
  title: string;
  start: string;
  end?: string;
  description?: string;
  calendarId?: string;
  timeZone?: string;
};

function getTimeZoneOffset(timeZone: string, date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const zonePart = formatter
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  if (!zonePart) {
    throw new IntegrationError(
      `Google Calendar用のタイムゾーン ${timeZone} を解釈できませんでした。`
    );
  }

  const match = zonePart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);

  if (!match) {
    throw new IntegrationError(
      `Google Calendar用のタイムゾーンオフセットを取得できませんでした: ${zonePart}`
    );
  }

  const hours = match[1];
  const minutes = match[2] ?? '00';
  const sign = hours.startsWith('-') ? '-' : '+';
  const normalizedHours = hours.replace(/[+-]/, '').padStart(2, '0');

  return `${sign}${normalizedHours}:${minutes}`;
}

function getDatePartsInTimeZone(
  date: Date,
  timeZone: string
): { year: string; month: string; day: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new IntegrationError('Google Calendar用の日付計算に失敗しました。');
  }

  return { year, month, day };
}

function buildZonedDateTime(date: Date, timeZone: string, time: string): Date {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  const offset = getTimeZoneOffset(timeZone, date);
  return new Date(`${year}-${month}-${day}T${time}:00${offset}`);
}

function getTodayRange(timeZone: string): { timeMin: string; timeMax: string } {
  const now = new Date();
  const start = buildZonedDateTime(now, timeZone, '00:00');
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

function parseDateTimeInput(value: string, timeZone: string): Date {
  const trimmed = value.trim();

  if (/([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    const parsed = new Date(trimmed);

    if (Number.isNaN(parsed.getTime())) {
      throw new IntegrationError(
        '日時を解釈できませんでした。`2026-05-17 14:00` または ISO 8601 形式で入力してください。'
      );
    }

    return parsed;
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);

  if (!match) {
    throw new IntegrationError(
      '日時は `YYYY-MM-DD HH:mm` 形式で入力してください。例: `2026-05-17 14:00`'
    );
  }

  const [, year, month, day, hour, minute] = match;
  const offset = getTimeZoneOffset(
    timeZone,
    new Date(`${year}-${month}-${day}T12:00:00Z`)
  );
  const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:00${offset}`);

  if (Number.isNaN(parsed.getTime())) {
    throw new IntegrationError(
      '日時を解釈できませんでした。`2026-05-17 14:00` または ISO 8601 形式で入力してください。'
    );
  }

  return parsed;
}

function formatEventTime(eventDateTime?: GoogleCalendarDateTime): string | null {
  if (!eventDateTime) {
    return null;
  }

  if (eventDateTime.date) {
    return eventDateTime.date;
  }

  return eventDateTime.dateTime ?? null;
}

function mapCalendarEvent(event: GoogleCalendarEventResponse): GoogleCalendarEvent {
  return {
    id: event.id,
    title: event.summary?.trim() || '無題',
    url: event.htmlLink ?? null,
    start: formatEventTime(event.start),
    end: formatEventTime(event.end),
    isAllDay: Boolean(event.start?.date && !event.start.dateTime),
  };
}

async function getAccessToken(): Promise<string> {
  const clientId = requireEnvVar('GOOGLE_CLIENT_ID', 'Google');
  const clientSecret = requireEnvVar('GOOGLE_CLIENT_SECRET', 'Google');
  const refreshToken = requireEnvVar('GOOGLE_REFRESH_TOKEN', 'Google');
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetchJson<GoogleTokenResponse>(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
    'Googleアクセストークンの取得に失敗しました。クライアントID・シークレット・リフレッシュトークンを確認してください。'
  );

  return response.access_token;
}

async function getHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function listCalendarEvents(
  options: GoogleCalendarListOptions = {}
): Promise<GoogleCalendarEvent[]> {
  const calendarId = options.calendarId?.trim() || DEFAULT_CALENDAR_ID;
  const todayRange = getTodayRange(DEFAULT_TIMEZONE);
  const params = new URLSearchParams({
    timeMin: options.timeMin ?? todayRange.timeMin,
    timeMax: options.timeMax ?? todayRange.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(options.maxResults ?? 10),
  });

  if (options.query?.trim()) {
    params.set('q', options.query.trim());
  }

  const response = await fetchJson<GoogleCalendarEventsResponse>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    {
      method: 'GET',
      headers: await getHeaders(),
    },
    'Google Calendarの予定取得に失敗しました。カレンダー権限を確認してください。'
  );

  return (response.items ?? [])
    .filter((event) => event.status !== 'cancelled')
    .map(mapCalendarEvent);
}

export async function listTodayCalendarEvents(): Promise<GoogleCalendarEvent[]> {
  return listCalendarEvents();
}

export async function createCalendarEvent(
  input: GoogleCalendarCreateInput
): Promise<CreatedGoogleCalendarEvent> {
  const title = input.title.trim();

  if (!title) {
    throw new IntegrationError('イベントタイトルを入力してください。');
  }

  const timeZone = input.timeZone?.trim() || DEFAULT_TIMEZONE;
  const start = parseDateTimeInput(input.start, timeZone);
  const end = input.end?.trim()
    ? parseDateTimeInput(input.end, timeZone)
    : new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
  const calendarId = input.calendarId?.trim() || DEFAULT_CALENDAR_ID;

  if (end.getTime() <= start.getTime()) {
    throw new IntegrationError('終了日時は開始日時より後にしてください。');
  }

  const response = await fetchJson<GoogleCalendarEventResponse>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        summary: title,
        description: input.description?.trim() || undefined,
        start: {
          dateTime: start.toISOString(),
          timeZone,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone,
        },
      }),
    },
    'Google Calendarの予定作成に失敗しました。カレンダー権限と入力内容を確認してください。'
  );

  return {
    id: response.id,
    title: response.summary?.trim() || title,
    url: response.htmlLink ?? null,
    start: formatEventTime(response.start) ?? start.toISOString(),
    end: formatEventTime(response.end) ?? end.toISOString(),
  };
}

export async function addCalendarEvent(
  title: string,
  dateTimeInput: string
): Promise<CreatedGoogleCalendarEvent> {
  return createCalendarEvent({
    title,
    start: dateTimeInput,
  });
}

export function formatCalendarDateTime(
  value: string | null,
  timeZone = DEFAULT_TIMEZONE
): string {
  if (!value) {
    return '未設定';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value} 終日`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ja-JP', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}
