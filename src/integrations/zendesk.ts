import { IntegrationError } from './errors';

const ZENDESK_API_VERSION_PATH = '/api/v2';

type ZendeskTicketsResponse = {
  tickets?: Array<{
    id?: number;
    subject?: string;
    status?: string;
    priority?: string | null;
    created_at?: string;
    via?: {
      source?: {
        from?: {
          name?: string;
        };
      };
    };
  }>;
};

type ZendeskTicketResponse = {
  ticket?: {
    id?: number;
    subject?: string;
    status?: string;
    description?: string;
  };
};

type ZendeskCreateTicketResponse = {
  ticket?: {
    id?: number;
    subject?: string;
  };
};

function normalizeCredential(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new IntegrationError(`Zendeskの${label}が設定されていません。`);
  }

  return normalized;
}

function getZendeskBaseUrl(subdomain: string): string {
  return `https://${normalizeCredential(subdomain, 'subdomain')}.zendesk.com${ZENDESK_API_VERSION_PATH}`;
}

function getAuthorizationHeader(email: string, token: string): string {
  const normalizedEmail = normalizeCredential(email, 'email');
  const normalizedToken = normalizeCredential(token, 'API token');
  return `Basic ${Buffer.from(`${normalizedEmail}/token:${normalizedToken}`).toString('base64')}`;
}

async function zendeskRequest<T>(
  email: string,
  token: string,
  subdomain: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getZendeskBaseUrl(subdomain)}${path}`, {
      ...init,
      headers: {
        Authorization: getAuthorizationHeader(email, token),
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
  email: string,
  token: string,
  subdomain: string
): Promise<
  Array<{
    id: number;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    requester_name: string;
  }>
> {
  const response = await zendeskRequest<ZendeskTicketsResponse>(
    email,
    token,
    subdomain,
    '/tickets.json?per_page=20',
    {
      method: 'GET',
    },
    'Zendeskのチケット一覧取得に失敗しました。'
  );

  return (response.tickets ?? []).map((ticket) => ({
    id: typeof ticket.id === 'number' ? ticket.id : 0,
    subject: typeof ticket.subject === 'string' && ticket.subject.trim() ? ticket.subject : '(No subject)',
    status: typeof ticket.status === 'string' ? ticket.status : '',
    priority: typeof ticket.priority === 'string' ? ticket.priority : '',
    created_at: typeof ticket.created_at === 'string' ? ticket.created_at : '',
    requester_name:
      typeof ticket.via?.source?.from?.name === 'string' ? ticket.via.source.from.name : '',
  }));
}

export async function getTicket(
  email: string,
  token: string,
  subdomain: string,
  id: number
): Promise<{ id: number; subject: string; status: string; description: string }> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new IntegrationError('Zendeskのticket IDを正しく指定してください。');
  }

  const response = await zendeskRequest<ZendeskTicketResponse>(
    email,
    token,
    subdomain,
    `/tickets/${id}.json`,
    {
      method: 'GET',
    },
    'Zendeskのチケット詳細取得に失敗しました。'
  );

  if (!response.ticket || typeof response.ticket.id !== 'number') {
    throw new IntegrationError('Zendeskのチケット詳細取得に失敗しました。');
  }

  return {
    id: response.ticket.id,
    subject:
      typeof response.ticket.subject === 'string' && response.ticket.subject.trim()
        ? response.ticket.subject
        : '(No subject)',
    status: typeof response.ticket.status === 'string' ? response.ticket.status : '',
    description: typeof response.ticket.description === 'string' ? response.ticket.description : '',
  };
}

export async function createTicket(
  email: string,
  token: string,
  subdomain: string,
  subject: string,
  body: string,
  requesterEmail: string
): Promise<{ id: number; subject: string }> {
  const normalizedSubject = subject.trim();
  const normalizedBody = body.trim();
  const normalizedRequesterEmail = requesterEmail.trim();

  if (!normalizedSubject) {
    throw new IntegrationError('Zendeskのsubjectを指定してください。');
  }

  if (!normalizedBody) {
    throw new IntegrationError('Zendeskのbodyを指定してください。');
  }

  if (!normalizedRequesterEmail) {
    throw new IntegrationError('Zendeskのrequester emailを指定してください。');
  }

  const response = await zendeskRequest<ZendeskCreateTicketResponse>(
    email,
    token,
    subdomain,
    '/tickets.json',
    {
      method: 'POST',
      body: JSON.stringify({
        ticket: {
          subject: normalizedSubject,
          comment: {
            body: normalizedBody,
          },
          requester: {
            email: normalizedRequesterEmail,
          },
        },
      }),
    },
    'Zendeskのチケット作成に失敗しました。'
  );

  if (!response.ticket || typeof response.ticket.id !== 'number') {
    throw new IntegrationError('Zendeskのチケット作成に失敗しました。');
  }

  return {
    id: response.ticket.id,
    subject:
      typeof response.ticket.subject === 'string' && response.ticket.subject.trim()
        ? response.ticket.subject
        : normalizedSubject,
  };
}
