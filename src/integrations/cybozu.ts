import { IntegrationError } from './errors';

const CYBOZU_API_PATH = '/g/api/v1';

type CybozuSchedulesResponse = {
  events?: Array<{
    id?: string;
    subject?: string;
    start?: {
      dateTime?: string;
    };
    end?: {
      dateTime?: string;
    };
    attendees?: Array<{
      name?: string;
    }>;
  }>;
};

type CybozuCreateScheduleResponse = {
  id?: string;
};

type CybozuBulletinBoardsResponse = {
  bulletinBoardCategories?: Array<{
    id?: string;
    name?: string;
  }>;
};

function normalizeCredential(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Cybozu Officeの${label}が設定されていません。`);
  }

  return trimmed;
}

function normalizeSubdomain(subdomain: string): string {
  const normalized = normalizeCredential(subdomain, 'subdomain');

  if (!/^[a-z0-9-]+$/i.test(normalized)) {
    throw new IntegrationError('Cybozu Officeのsubdomain形式が不正です。');
  }

  return normalized;
}

function buildHeaders(login: string, password: string): Record<string, string> {
  const authorization = Buffer.from(
    `${normalizeCredential(login, 'login')}:${normalizeCredential(password, 'password')}`
  ).toString('base64');

  return {
    'X-Cybozu-Authorization': authorization,
    'Content-Type': 'application/json',
  };
}

async function cybozuRequest<T>(
  subdomain: string,
  login: string,
  password: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`https://${normalizeSubdomain(subdomain)}.cybozu.com${CYBOZU_API_PATH}${path}`, {
      ...init,
      headers: {
        ...buildHeaders(login, password),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new IntegrationError(fallbackMessage);
  }

  return payload as T;
}

export async function getSchedules(
  login: string,
  password: string,
  subdomain: string,
  date: string
): Promise<Array<{ id: string; subject: string; start: string; end: string; members: string[] }>> {
  const normalizedDate = date.trim();

  if (!normalizedDate) {
    throw new IntegrationError('Cybozu Officeのdateを指定してください。');
  }

  const searchParams = new URLSearchParams({
    rangeStart: normalizedDate,
    rangeEnd: normalizedDate,
  });
  const response = await cybozuRequest<CybozuSchedulesResponse>(
    subdomain,
    login,
    password,
    `/schedule/events?${searchParams.toString()}`,
    { method: 'GET' },
    'Cybozu Officeのスケジュール一覧取得に失敗しました。'
  );

  return (response.events ?? []).map((event) => ({
    id: typeof event.id === 'string' ? event.id : '',
    subject: typeof event.subject === 'string' && event.subject.trim() ? event.subject : '(No subject)',
    start: typeof event.start?.dateTime === 'string' ? event.start.dateTime : '',
    end: typeof event.end?.dateTime === 'string' ? event.end.dateTime : '',
    members: (event.attendees ?? [])
      .map((attendee) => attendee.name)
      .filter((name): name is string => typeof name === 'string' && Boolean(name.trim())),
  }));
}

export async function createSchedule(
  login: string,
  password: string,
  subdomain: string,
  subject: string,
  start: string,
  end: string
): Promise<{ id: string }> {
  const normalizedSubject = subject.trim();
  const normalizedStart = start.trim();
  const normalizedEnd = end.trim();

  if (!normalizedSubject) {
    throw new IntegrationError('Cybozu Officeのsubjectを指定してください。');
  }

  if (!normalizedStart || !normalizedEnd) {
    throw new IntegrationError('Cybozu Officeのstartとendを指定してください。');
  }

  const response = await cybozuRequest<CybozuCreateScheduleResponse>(
    subdomain,
    login,
    password,
    '/schedule/events',
    {
      method: 'POST',
      body: JSON.stringify({
        subject: normalizedSubject,
        start: { dateTime: normalizedStart },
        end: { dateTime: normalizedEnd },
      }),
    },
    'Cybozu Officeのスケジュール作成に失敗しました。'
  );

  if (typeof response.id !== 'string' || !response.id.trim()) {
    throw new IntegrationError('Cybozu Office APIレスポンスの形式が不正です。');
  }

  return { id: response.id };
}

export async function getBulletinBoards(
  login: string,
  password: string,
  subdomain: string
): Promise<Array<{ id: string; name: string }>> {
  const response = await cybozuRequest<CybozuBulletinBoardsResponse>(
    subdomain,
    login,
    password,
    '/bulletin/categories',
    { method: 'GET' },
    'Cybozu Officeの掲示板カテゴリ一覧取得に失敗しました。'
  );

  return (response.bulletinBoardCategories ?? []).map((category) => ({
    id: typeof category.id === 'string' ? category.id : '',
    name: typeof category.name === 'string' && category.name.trim() ? category.name : '(No name)',
  }));
}
