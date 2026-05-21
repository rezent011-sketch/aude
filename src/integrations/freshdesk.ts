import { IntegrationError } from './errors';

const FRESHDESK_API_VERSION_PATH = '/api/v2';

type FreshdeskTicket = {
  id?: number;
  subject?: string;
  status?: number;
  priority?: number;
  created_at?: string;
};

type FreshdeskCreateTicketResponse = {
  id?: number;
  subject?: string;
};

function normalizeCredential(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new IntegrationError(`Freshdeskの${label}が設定されていません。`);
  }

  return normalized;
}

function getFreshdeskBaseUrl(domain: string): string {
  return `https://${normalizeCredential(domain, 'domain')}.freshdesk.com${FRESHDESK_API_VERSION_PATH}`;
}

function getAuthorizationHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${normalizeCredential(apiKey, 'API key')}:X`).toString('base64')}`;
}

async function freshdeskRequest<T>(
  apiKey: string,
  domain: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getFreshdeskBaseUrl(domain)}${path}`, {
      ...init,
      headers: {
        Authorization: getAuthorizationHeader(apiKey),
        'Content-Type': 'application/json; charset=utf-8',
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

export async function getTickets(
  apiKey: string,
  domain: string
): Promise<
  Array<{
    id: number;
    subject: string;
    status: number;
    priority: number;
    created_at: string;
  }>
> {
  const response = await freshdeskRequest<FreshdeskTicket[]>(
    apiKey,
    domain,
    '/tickets?per_page=20',
    {
      method: 'GET',
    },
    'Freshdeskのチケット一覧取得に失敗しました。'
  );

  return (response ?? []).map((ticket) => ({
    id: typeof ticket.id === 'number' ? ticket.id : 0,
    subject: typeof ticket.subject === 'string' && ticket.subject.trim() ? ticket.subject : '(No subject)',
    status: typeof ticket.status === 'number' ? ticket.status : 0,
    priority: typeof ticket.priority === 'number' ? ticket.priority : 0,
    created_at: typeof ticket.created_at === 'string' ? ticket.created_at : '',
  }));
}

export async function createTicket(
  apiKey: string,
  domain: string,
  subject: string,
  description: string,
  email: string,
  priority?: number
): Promise<{ id: number; subject: string }> {
  const normalizedSubject = subject.trim();
  const normalizedDescription = description.trim();
  const normalizedEmail = email.trim();

  if (!normalizedSubject) {
    throw new IntegrationError('Freshdeskのsubjectを指定してください。');
  }

  if (!normalizedDescription) {
    throw new IntegrationError('Freshdeskのdescriptionを指定してください。');
  }

  if (!normalizedEmail) {
    throw new IntegrationError('Freshdeskのemailを指定してください。');
  }

  const response = await freshdeskRequest<FreshdeskCreateTicketResponse>(
    apiKey,
    domain,
    '/tickets',
    {
      method: 'POST',
      body: JSON.stringify({
        subject: normalizedSubject,
        description: normalizedDescription,
        email: normalizedEmail,
        priority: priority ?? 1,
        status: 2,
      }),
    },
    'Freshdeskのチケット作成に失敗しました。'
  );

  if (typeof response.id !== 'number') {
    throw new IntegrationError('Freshdeskのチケット作成に失敗しました。');
  }

  return {
    id: response.id,
    subject:
      typeof response.subject === 'string' && response.subject.trim()
        ? response.subject
        : normalizedSubject,
  };
}

export async function addNote(
  apiKey: string,
  domain: string,
  ticketId: number,
  body: string
): Promise<void> {
  const normalizedBody = body.trim();

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    throw new IntegrationError('Freshdeskのticket IDを正しく指定してください。');
  }

  if (!normalizedBody) {
    throw new IntegrationError('Freshdeskのnote本文を指定してください。');
  }

  await freshdeskRequest<unknown>(
    apiKey,
    domain,
    `/tickets/${ticketId}/notes`,
    {
      method: 'POST',
      body: JSON.stringify({
        body: normalizedBody,
        private: false,
      }),
    },
    'Freshdeskへのノート追加に失敗しました。'
  );
}
