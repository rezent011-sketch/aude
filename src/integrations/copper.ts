import { IntegrationError } from './errors';

const COPPER_API_BASE_URL = 'https://api.copper.com/developer_api/v1';

type CopperErrorResponse = {
  message?: string;
};

type CopperPersonResponse = {
  id?: number;
  name?: string;
  emails?: Array<{
    email?: string;
  }>;
  company_name?: string;
};

type CopperOpportunityResponse = {
  id?: number;
  name?: string;
  status?: string;
  monetary_value?: number;
  close_date?: string;
};

type CopperCreatePersonResponse = {
  id?: number;
  name?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('CopperのAPI tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeUserEmail(userEmail: string): string {
  const trimmed = userEmail.trim();

  if (!trimmed) {
    throw new IntegrationError('Copperのuser emailが設定されていません。');
  }

  return trimmed;
}

function normalizeRequired(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Copperの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as CopperErrorResponse).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function copperRequest<T>(
  path: string,
  token: string,
  userEmail: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${COPPER_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'X-PW-AccessToken': normalizeToken(token),
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': normalizeUserEmail(userEmail),
        'Content-Type': 'application/json',
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

export async function searchPeople(
  token: string,
  email: string,
  userEmail: string
): Promise<Array<{ id: number; name: string; email: string; company_name: string }>> {
  const normalizedEmail = email.trim();
  const body: Record<string, unknown> = {
    page_size: 20,
  };

  if (normalizedEmail) {
    body.emails = [normalizedEmail];
  }

  const response = await copperRequest<CopperPersonResponse[]>(
    '/people/search',
    token,
    userEmail,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    'Copperの連絡先検索に失敗しました。'
  );

  return (response ?? []).map((person) => ({
    id: typeof person.id === 'number' ? person.id : 0,
    name: typeof person.name === 'string' && person.name.trim() ? person.name : '(No name)',
    email: typeof person.emails?.[0]?.email === 'string' ? person.emails[0].email : '',
    company_name: typeof person.company_name === 'string' ? person.company_name : '',
  }));
}

export async function getOpportunities(
  token: string,
  userEmail: string
): Promise<
  Array<{
    id: number;
    name: string;
    status: string;
    monetary_value: number;
    close_date: string;
  }>
> {
  const response = await copperRequest<CopperOpportunityResponse[]>(
    '/opportunities/search',
    token,
    userEmail,
    {
      method: 'POST',
      body: JSON.stringify({ page_size: 20 }),
    },
    'Copperの商談一覧取得に失敗しました。'
  );

  return (response ?? []).map((opportunity) => ({
    id: typeof opportunity.id === 'number' ? opportunity.id : 0,
    name: typeof opportunity.name === 'string' && opportunity.name.trim() ? opportunity.name : '(No name)',
    status: typeof opportunity.status === 'string' ? opportunity.status : '',
    monetary_value:
      typeof opportunity.monetary_value === 'number' ? opportunity.monetary_value : 0,
    close_date: typeof opportunity.close_date === 'string' ? opportunity.close_date : '',
  }));
}

export async function createPerson(
  token: string,
  userEmail: string,
  name: string,
  email: string
): Promise<{ id: number; name: string }> {
  const response = await copperRequest<CopperCreatePersonResponse>(
    '/people',
    token,
    userEmail,
    {
      method: 'POST',
      body: JSON.stringify({
        name: normalizeRequired(name, 'name'),
        emails: [{ email: normalizeRequired(email, 'email'), category: 'work' }],
      }),
    },
    'Copperの連絡先作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'number' ? response.id : 0,
    name: typeof response.name === 'string' ? response.name : '',
  };
}
