import { IntegrationError } from './errors';

const HEROKU_API_BASE_URL = 'https://api.heroku.com';

type HerokuApp = {
  id?: string;
  name?: string;
  web_url?: string | null;
  stack?: {
    name?: string;
  } | null;
  region?: {
    name?: string;
  } | null;
};

type HerokuDyno = {
  id?: string;
  type?: string;
  state?: string;
  size?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('HerokuのAPI Tokenが設定されていません。');
  }

  return trimmed;
}

function getHeaders(token: string, extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeToken(token)}`,
    Accept: 'application/vnd.heroku+json; version=3',
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const id = (payload as { id?: unknown }).id;
  if (typeof id === 'string' && id.trim()) {
    return id;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return null;
}

async function herokuRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${HEROKU_API_BASE_URL}${path}`, {
      ...init,
      headers: getHeaders(token, init.headers as Record<string, string> | undefined),
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const apiMessage = extractApiError(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getApps(
  token: string
): Promise<Array<{ id: string; name: string; web_url: string; stack: string; region: string }>> {
  const response = await herokuRequest<HerokuApp[]>(
    '/apps',
    token,
    { method: 'GET' },
    'Herokuのapp一覧取得に失敗しました。'
  );

  return response.map((app) => ({
    id: typeof app.id === 'string' ? app.id : '',
    name: typeof app.name === 'string' && app.name.trim() ? app.name : '(No name)',
    web_url: typeof app.web_url === 'string' ? app.web_url : '',
    stack: typeof app.stack?.name === 'string' && app.stack.name.trim() ? app.stack.name : '-',
    region: typeof app.region?.name === 'string' && app.region.name.trim() ? app.region.name : '-',
  }));
}

export async function getDynos(
  token: string,
  appName: string
): Promise<Array<{ id: string; type: string; state: string; size: string }>> {
  const normalizedAppName = appName.trim();

  if (!normalizedAppName) {
    throw new IntegrationError('Herokuのapp_nameを指定してください。');
  }

  const response = await herokuRequest<HerokuDyno[]>(
    `/apps/${encodeURIComponent(normalizedAppName)}/dynos`,
    token,
    { method: 'GET' },
    'HerokuのDyno一覧取得に失敗しました。'
  );

  return response.map((dyno) => ({
    id: typeof dyno.id === 'string' ? dyno.id : '',
    type: typeof dyno.type === 'string' && dyno.type.trim() ? dyno.type : 'unknown',
    state: typeof dyno.state === 'string' && dyno.state.trim() ? dyno.state : 'unknown',
    size: typeof dyno.size === 'string' && dyno.size.trim() ? dyno.size : 'unknown',
  }));
}

export async function restartDynos(token: string, appName: string): Promise<void> {
  const normalizedAppName = appName.trim();

  if (!normalizedAppName) {
    throw new IntegrationError('Herokuのapp_nameを指定してください。');
  }

  await herokuRequest<unknown>(
    `/apps/${encodeURIComponent(normalizedAppName)}/dynos`,
    token,
    { method: 'DELETE' },
    'HerokuのDyno再起動に失敗しました。'
  );
}
