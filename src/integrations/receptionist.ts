import { IntegrationError } from './errors';

const RECEPTIONIST_API_BASE_URL = 'https://api.receptionist.jp/v1';

type ReceptionistVisitorsResponse = {
  visitors?: Array<{
    id?: string;
    visitor_name?: string;
    company?: string;
    host_name?: string;
    checked_in_at?: string;
    status?: string;
  }>;
};

type ReceptionistVisitorResponse = {
  visitor?: {
    id?: string;
    visitor_name?: string;
    company?: string;
    host_name?: string;
    purpose?: string;
    checked_in_at?: string;
  };
};

type ReceptionistNotificationResponse = {
  notification?: {
    id?: string;
  };
  message?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('RECEPTIONIST API tokenが設定されていません。');
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

async function receptionistRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${RECEPTIONIST_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizeToken(token)}`,
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

export async function getVisitors(
  token: string
): Promise<
  Array<{
    id: string;
    visitor_name: string;
    company: string;
    host_name: string;
    checked_in_at: string;
    status: string;
  }>
> {
  const response = await receptionistRequest<ReceptionistVisitorsResponse>(
    '/visitors',
    token,
    { method: 'GET' },
    'RECEPTIONISTの来客一覧取得に失敗しました。'
  );

  return (response.visitors ?? []).map((visitor) => ({
    id: typeof visitor.id === 'string' ? visitor.id : '',
    visitor_name:
      typeof visitor.visitor_name === 'string' && visitor.visitor_name.trim()
        ? visitor.visitor_name
        : '(No name)',
    company: typeof visitor.company === 'string' ? visitor.company : '',
    host_name: typeof visitor.host_name === 'string' ? visitor.host_name : '',
    checked_in_at: typeof visitor.checked_in_at === 'string' ? visitor.checked_in_at : '',
    status: typeof visitor.status === 'string' && visitor.status.trim() ? visitor.status : 'unknown',
  }));
}

export async function getVisitor(
  token: string,
  id: string
): Promise<{
  id: string;
  visitor_name: string;
  company: string;
  host_name: string;
  purpose: string;
  checked_in_at: string;
}> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new IntegrationError('RECEPTIONISTのvisitor IDを指定してください。');
  }

  const response = await receptionistRequest<ReceptionistVisitorResponse>(
    `/visitors/${encodeURIComponent(normalizedId)}`,
    token,
    { method: 'GET' },
    'RECEPTIONISTの来客詳細取得に失敗しました。'
  );

  if (!response.visitor) {
    throw new IntegrationError('RECEPTIONIST APIレスポンスの形式が不正です。');
  }

  return {
    id: typeof response.visitor.id === 'string' ? response.visitor.id : '',
    visitor_name:
      typeof response.visitor.visitor_name === 'string' ? response.visitor.visitor_name : '',
    company: typeof response.visitor.company === 'string' ? response.visitor.company : '',
    host_name: typeof response.visitor.host_name === 'string' ? response.visitor.host_name : '',
    purpose: typeof response.visitor.purpose === 'string' ? response.visitor.purpose : '',
    checked_in_at:
      typeof response.visitor.checked_in_at === 'string' ? response.visitor.checked_in_at : '',
  };
}

export async function createVisitorNotification(
  token: string,
  hostName: string,
  visitorName: string,
  company: string
): Promise<{ id: string }> {
  const normalizedHostName = hostName.trim();
  const normalizedVisitorName = visitorName.trim();
  const normalizedCompany = company.trim();

  if (!normalizedHostName) {
    throw new IntegrationError('RECEPTIONISTのhost_nameを指定してください。');
  }

  if (!normalizedVisitorName) {
    throw new IntegrationError('RECEPTIONISTのvisitor_nameを指定してください。');
  }

  if (!normalizedCompany) {
    throw new IntegrationError('RECEPTIONISTのcompanyを指定してください。');
  }

  const response = await receptionistRequest<ReceptionistNotificationResponse>(
    '/notifications',
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host_name: normalizedHostName,
        visitor_name: normalizedVisitorName,
        company: normalizedCompany,
      }),
    },
    'RECEPTIONISTの来客通知作成に失敗しました。'
  );

  if (typeof response.notification?.id !== 'string') {
    throw new IntegrationError('RECEPTIONIST APIレスポンスの形式が不正です。');
  }

  return { id: response.notification.id };
}
