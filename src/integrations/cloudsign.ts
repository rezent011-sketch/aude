import { IntegrationError } from './errors';

const CLOUDSIGN_API_BASE_URL = 'https://app.cloudsign.jp/api';

type CloudsignDocumentsResponse = {
  documents?: Array<{
    id?: string;
    title?: string;
    status?: string;
    created_at?: string;
  }>;
};

type CloudsignDocumentResponse = {
  document?: {
    id?: string;
    title?: string;
    status?: string;
    participants?: Array<{
      email?: string;
      status?: string;
    }>;
  };
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('クラウドサインのAPIトークンが設定されていません。');
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

async function cloudsignRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${CLOUDSIGN_API_BASE_URL}${path}`, {
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

export async function getDocuments(
  token: string
): Promise<Array<{ id: string; title: string; status: string; created_at: string }>> {
  const response = await cloudsignRequest<CloudsignDocumentsResponse>(
    '/documents',
    token,
    { method: 'GET' },
    'クラウドサインの契約書一覧取得に失敗しました。'
  );

  return (response.documents ?? []).map((document) => ({
    id: typeof document.id === 'string' ? document.id : '',
    title: typeof document.title === 'string' && document.title.trim() ? document.title : '(No title)',
    status: typeof document.status === 'string' && document.status.trim() ? document.status : 'unknown',
    created_at: typeof document.created_at === 'string' ? document.created_at : '',
  }));
}

export async function getDocument(
  token: string,
  id: string
): Promise<{
  id: string;
  title: string;
  status: string;
  participants: Array<{ email: string; status: string }>;
}> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new IntegrationError('クラウドサインのdocument IDを指定してください。');
  }

  const response = await cloudsignRequest<CloudsignDocumentResponse>(
    `/documents/${encodeURIComponent(normalizedId)}`,
    token,
    { method: 'GET' },
    'クラウドサインの契約書詳細取得に失敗しました。'
  );

  return {
    id: typeof response.document?.id === 'string' ? response.document.id : normalizedId,
    title:
      typeof response.document?.title === 'string' && response.document.title.trim()
        ? response.document.title
        : '(No title)',
    status:
      typeof response.document?.status === 'string' && response.document.status.trim()
        ? response.document.status
        : 'unknown',
    participants: (response.document?.participants ?? []).map((participant) => ({
      email:
        typeof participant.email === 'string' && participant.email.trim()
          ? participant.email
          : '(No email)',
      status:
        typeof participant.status === 'string' && participant.status.trim()
          ? participant.status
          : 'unknown',
    })),
  };
}

export async function createDocument(
  token: string,
  title: string
): Promise<{ id: string; title: string }> {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new IntegrationError('クラウドサインのtitleを指定してください。');
  }

  const response = await cloudsignRequest<CloudsignDocumentResponse>(
    '/documents',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        document: {
          title: normalizedTitle,
        },
      }),
    },
    'クラウドサインの契約書作成に失敗しました。'
  );

  return {
    id: typeof response.document?.id === 'string' ? response.document.id : '',
    title:
      typeof response.document?.title === 'string' && response.document.title.trim()
        ? response.document.title
        : normalizedTitle,
  };
}
