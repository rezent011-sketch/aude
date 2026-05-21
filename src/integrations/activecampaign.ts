import { IntegrationError } from './errors';

type ActiveCampaignContactsResponse = {
  contacts?: Array<{
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }>;
};

type ActiveCampaignListsResponse = {
  lists?: Array<{
    id?: string;
    name?: string;
    subscriberCount?: number | string;
  }>;
};

type ActiveCampaignCreateContactResponse = {
  contact?: {
    id?: string;
    email?: string;
  };
};

function normalizeToken(token: string): string {
  const normalized = token.trim();

  if (!normalized) {
    throw new IntegrationError('ActiveCampaignのAPI tokenが設定されていません。');
  }

  return normalized;
}

function normalizeAccount(account: string): string {
  const normalized = account.trim().replace(/^https?:\/\//i, '').replace(/\.api-us1\.com\/?$/i, '');

  if (!normalized) {
    throw new IntegrationError('ActiveCampaignのaccountを設定してください。');
  }

  return normalized;
}

function normalizeEmail(email: string): string {
  const normalized = email.trim();

  if (!normalized) {
    throw new IntegrationError('ActiveCampaignのemailを指定してください。');
  }

  return normalized;
}

function getBaseUrl(account: string): string {
  return `https://${normalizeAccount(account)}.api-us1.com/api/3`;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const errors = (payload as { errors?: unknown }).errors;
  if (Array.isArray(errors) && typeof errors[0] === 'string' && errors[0].trim()) {
    return errors[0];
  }

  return null;
}

async function activeCampaignRequest<T>(
  token: string,
  account: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getBaseUrl(account)}${path}`, {
      ...init,
      headers: {
        'Api-Token': normalizeToken(token),
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
    throw new IntegrationError(
      apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage
    );
  }

  return payload as T;
}

export async function getContacts(
  token: string,
  account: string,
  limit?: number
): Promise<Array<{ id: string; email: string; firstName: string; lastName: string }>> {
  const normalizedLimit =
    typeof limit === 'number' && Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 100)) : 20;
  const response = await activeCampaignRequest<ActiveCampaignContactsResponse>(
    token,
    account,
    `/contacts?limit=${normalizedLimit}`,
    {
      method: 'GET',
    },
    'ActiveCampaignのコンタクト一覧取得に失敗しました。'
  );

  return (response.contacts ?? []).map((contact) => ({
    id: typeof contact.id === 'string' ? contact.id : '',
    email: typeof contact.email === 'string' ? contact.email : '',
    firstName: typeof contact.firstName === 'string' ? contact.firstName : '',
    lastName: typeof contact.lastName === 'string' ? contact.lastName : '',
  }));
}

export async function getLists(
  token: string,
  account: string
): Promise<Array<{ id: string; name: string; subscriberCount: number }>> {
  const response = await activeCampaignRequest<ActiveCampaignListsResponse>(
    token,
    account,
    '/lists',
    {
      method: 'GET',
    },
    'ActiveCampaignのリスト一覧取得に失敗しました。'
  );

  return (response.lists ?? []).map((list) => ({
    id: typeof list.id === 'string' ? list.id : '',
    name: typeof list.name === 'string' ? list.name : '',
    subscriberCount:
      typeof list.subscriberCount === 'number'
        ? list.subscriberCount
        : typeof list.subscriberCount === 'string'
          ? Number(list.subscriberCount) || 0
          : 0,
  }));
}

export async function createContact(
  token: string,
  account: string,
  email: string,
  firstName?: string,
  lastName?: string
): Promise<{ id: string; email: string }> {
  const normalizedEmail = normalizeEmail(email);
  const response = await activeCampaignRequest<ActiveCampaignCreateContactResponse>(
    token,
    account,
    '/contacts',
    {
      method: 'POST',
      body: JSON.stringify({
        contact: {
          email: normalizedEmail,
          firstName: firstName?.trim() ?? '',
          lastName: lastName?.trim() ?? '',
        },
      }),
    },
    'ActiveCampaignのコンタクト作成に失敗しました。'
  );

  return {
    id: typeof response.contact?.id === 'string' ? response.contact.id : '',
    email:
      typeof response.contact?.email === 'string' && response.contact.email.trim()
        ? response.contact.email
        : normalizedEmail,
  };
}
