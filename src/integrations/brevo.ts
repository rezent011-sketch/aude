import { IntegrationError } from './errors';

const BREVO_API_BASE_URL = 'https://api.brevo.com/v3';

type BrevoErrorResponse = {
  message?: string;
  code?: string;
};

type BrevoContactsResponse = {
  contacts?: Array<{
    id?: number;
    email?: string;
    attributes?: {
      FIRSTNAME?: string;
      LASTNAME?: string;
    };
  }>;
};

type BrevoSendEmailResponse = {
  messageId?: string;
};

type BrevoStatsResponse = {
  requests?: number;
  delivered?: number;
  hardBounces?: number;
  softBounces?: number;
  opens?: number;
  clicks?: number;
};

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('BrevoのAPI keyが設定されていません。');
  }

  return trimmed;
}

function normalizeRequired(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Brevoの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as BrevoErrorResponse).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const code = (payload as BrevoErrorResponse).code;
  return typeof code === 'string' && code.trim() ? code : null;
}

async function brevoRequest<T>(
  path: string,
  apiKey: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BREVO_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'api-key': normalizeApiKey(apiKey),
        'Content-Type': 'application/json; charset=utf-8',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getContacts(
  apiKey: string,
  limit?: number
): Promise<Array<{ id: number; email: string; firstName: string; lastName: string }>> {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit as number)) : 20;
  const response = await brevoRequest<BrevoContactsResponse>(
    `/contacts?limit=${normalizedLimit}`,
    apiKey,
    { method: 'GET' },
    'Brevoのコンタクト一覧取得に失敗しました。'
  );

  return (response.contacts ?? []).map((contact) => ({
    id: typeof contact.id === 'number' ? contact.id : 0,
    email: typeof contact.email === 'string' ? contact.email : '',
    firstName: typeof contact.attributes?.FIRSTNAME === 'string' ? contact.attributes.FIRSTNAME : '',
    lastName: typeof contact.attributes?.LASTNAME === 'string' ? contact.attributes.LASTNAME : '',
  }));
}

export async function sendTransactionalEmail(
  apiKey: string,
  to: string,
  subject: string,
  htmlContent: string,
  senderEmail: string,
  senderName?: string
): Promise<{ messageId: string }> {
  const response = await brevoRequest<BrevoSendEmailResponse>(
    '/smtp/email',
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        sender: {
          name: senderName?.trim() || 'Aude',
          email: normalizeRequired(senderEmail, 'sender email'),
        },
        to: [{ email: normalizeRequired(to, 'to') }],
        subject: normalizeRequired(subject, 'subject'),
        htmlContent: normalizeRequired(htmlContent, 'content'),
      }),
    },
    'Brevoのメール送信に失敗しました。'
  );

  return {
    messageId: typeof response.messageId === 'string' ? response.messageId : '',
  };
}

export async function getEmailStats(
  apiKey: string
): Promise<{
  requests: number;
  delivered: number;
  hardBounces: number;
  softBounces: number;
  opens: number;
  clicks: number;
}> {
  const response = await brevoRequest<BrevoStatsResponse>(
    '/smtp/statistics/aggregatedReport',
    apiKey,
    { method: 'GET' },
    'Brevoのメール統計取得に失敗しました。'
  );

  return {
    requests: typeof response.requests === 'number' ? response.requests : 0,
    delivered: typeof response.delivered === 'number' ? response.delivered : 0,
    hardBounces: typeof response.hardBounces === 'number' ? response.hardBounces : 0,
    softBounces: typeof response.softBounces === 'number' ? response.softBounces : 0,
    opens: typeof response.opens === 'number' ? response.opens : 0,
    clicks: typeof response.clicks === 'number' ? response.clicks : 0,
  };
}
