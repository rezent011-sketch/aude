import { IntegrationError } from './errors';
import { fetchJson } from './http';

type HubSpotListResponse<T> = {
  results?: T[];
};

type HubSpotContactResponse = {
  id?: string;
  properties?: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
  };
};

type HubSpotDealResponse = {
  id?: string;
  properties?: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
  };
};

type HubSpotCreateContactResponse = {
  id?: string;
};

function getHeaders(token: string): Record<string, string> {
  const normalized = token.trim();

  if (!normalized) {
    throw new IntegrationError('HubSpotアクセストークンが設定されていません。');
  }

  return {
    Authorization: `Bearer ${normalized}`,
    'Content-Type': 'application/json',
  };
}

function normalizeLimit(limit?: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 20;
  }

  return Math.max(1, Math.min(Math.trunc(limit), 100));
}

export async function getContacts(
  token: string,
  limit?: number
): Promise<Array<{ id: string; email: string; firstName: string; lastName: string; company: string }>> {
  const response = await fetchJson<HubSpotListResponse<HubSpotContactResponse>>(
    `https://api.hubapi.com/crm/v3/objects/contacts?limit=${normalizeLimit(limit)}&properties=email,firstname,lastname,company`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'HubSpotの連絡先一覧取得に失敗しました。'
  );

  return (response.results ?? []).map((contact) => {
    const p = contact.properties ?? {};

    return {
      id: typeof contact.id === 'string' ? contact.id : '',
      email: p.email ?? '',
      firstName: p.firstname ?? '',
      lastName: p.lastname ?? '',
      company: p.company ?? '',
    };
  });
}

export async function getDeals(
  token: string,
  limit?: number
): Promise<Array<{ id: string; dealname: string; amount: string; dealstage: string }>> {
  const response = await fetchJson<HubSpotListResponse<HubSpotDealResponse>>(
    `https://api.hubapi.com/crm/v3/objects/deals?limit=${normalizeLimit(limit)}&properties=dealname,amount,dealstage`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'HubSpotの案件一覧取得に失敗しました。'
  );

  return (response.results ?? []).map((deal) => ({
    id: typeof deal.id === 'string' ? deal.id : '',
    dealname: deal.properties?.dealname ?? '',
    amount: deal.properties?.amount ?? '',
    dealstage: deal.properties?.dealstage ?? '',
  }));
}

export async function createContact(
  token: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<{ id: string }> {
  const normalizedEmail = email.trim();
  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();

  if (!normalizedEmail) {
    throw new IntegrationError('HubSpotのemailを指定してください。');
  }

  if (!normalizedFirstName) {
    throw new IntegrationError('HubSpotのfirst_nameを指定してください。');
  }

  if (!normalizedLastName) {
    throw new IntegrationError('HubSpotのlast_nameを指定してください。');
  }

  const response = await fetchJson<HubSpotCreateContactResponse>(
    'https://api.hubapi.com/crm/v3/objects/contacts',
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        properties: {
          email: normalizedEmail,
          firstname: normalizedFirstName,
          lastname: normalizedLastName,
        },
      }),
    },
    'HubSpotの連絡先作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
  };
}
