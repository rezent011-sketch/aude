import { IntegrationError } from './errors';

const GMO_AGREE_API_BASE_URL = 'https://contractapi.agreepage.jp/api/v1';

type GmoAgreeDocumentsResponse = {
  documents?: Array<{
    document_id?: string;
    document_name?: string;
    status?: string;
    created_at?: string;
  }>;
};

type GmoAgreeDocumentResponse = {
  document?: {
    document_id?: string;
    document_name?: string;
    status?: string;
    signers?: Array<{
      name?: string;
      email?: string;
      status?: string;
    }>;
  };
};

type GmoAgreeReminderResponse = {
  result?: string;
};

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('GMO電子印鑑 AgreeのAPIキーが設定されていません。');
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

async function gmoAgreeRequest<T>(
  path: string,
  apiKey: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${GMO_AGREE_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'X-Agree-Api-Key': normalizeApiKey(apiKey),
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
  apiKey: string
): Promise<Array<{ document_id: string; document_name: string; status: string; created_at: string }>> {
  const response = await gmoAgreeRequest<GmoAgreeDocumentsResponse>(
    '/documents',
    apiKey,
    { method: 'GET' },
    'GMO電子印鑑 Agreeの書類一覧取得に失敗しました。'
  );

  return (response.documents ?? []).map((document) => ({
    document_id: typeof document.document_id === 'string' ? document.document_id : '',
    document_name:
      typeof document.document_name === 'string' && document.document_name.trim()
        ? document.document_name
        : '(No title)',
    status: typeof document.status === 'string' && document.status.trim() ? document.status : 'unknown',
    created_at: typeof document.created_at === 'string' ? document.created_at : '',
  }));
}

export async function getDocument(
  apiKey: string,
  documentId: string
): Promise<{
  document_id: string;
  document_name: string;
  status: string;
  signers: Array<{ name: string; email: string; status: string }>;
}> {
  const normalizedDocumentId = documentId.trim();

  if (!normalizedDocumentId) {
    throw new IntegrationError('GMO電子印鑑 Agreeのdocument IDを指定してください。');
  }

  const response = await gmoAgreeRequest<GmoAgreeDocumentResponse>(
    `/documents/${encodeURIComponent(normalizedDocumentId)}`,
    apiKey,
    { method: 'GET' },
    'GMO電子印鑑 Agreeの書類詳細取得に失敗しました。'
  );

  return {
    document_id:
      typeof response.document?.document_id === 'string'
        ? response.document.document_id
        : normalizedDocumentId,
    document_name:
      typeof response.document?.document_name === 'string' && response.document.document_name.trim()
        ? response.document.document_name
        : '(No title)',
    status:
      typeof response.document?.status === 'string' && response.document.status.trim()
        ? response.document.status
        : 'unknown',
    signers: (response.document?.signers ?? []).map((signer) => ({
      name: typeof signer.name === 'string' && signer.name.trim() ? signer.name : '(No name)',
      email: typeof signer.email === 'string' && signer.email.trim() ? signer.email : '(No email)',
      status: typeof signer.status === 'string' && signer.status.trim() ? signer.status : 'unknown',
    })),
  };
}

export async function sendReminder(apiKey: string, documentId: string): Promise<void> {
  const normalizedDocumentId = documentId.trim();

  if (!normalizedDocumentId) {
    throw new IntegrationError('GMO電子印鑑 Agreeのdocument IDを指定してください。');
  }

  const response = await gmoAgreeRequest<GmoAgreeReminderResponse>(
    `/documents/${encodeURIComponent(normalizedDocumentId)}/remind`,
    apiKey,
    { method: 'POST' },
    'GMO電子印鑑 Agreeの署名リマインド送信に失敗しました。'
  );

  if (response.result !== 'ok') {
    throw new IntegrationError('GMO電子印鑑 Agreeの署名リマインド送信に失敗しました。');
  }
}
