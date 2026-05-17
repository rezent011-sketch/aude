import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

type HubSpotPropertyValue = {
  value?: string;
};

type HubSpotContactResponse = {
  id: string;
  properties?: Record<string, string>;
};

type HubSpotListResponse<T> = {
  results?: T[];
};

type HubSpotDealResponse = {
  id: string;
  properties?: Record<string, string>;
};

export type HubSpotContact = {
  id: string;
  email: string;
  firstname: string;
  lastname: string;
  phone: string;
  company: string;
};

export type HubSpotDeal = {
  id: string;
  name: string;
  stage: string;
  amount: string;
  closeDate: string;
};

function getHeaders(): Record<string, string> {
  const token = requireEnvVar('HUBSPOT_API_KEY', 'HubSpot');

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function mapContact(response: HubSpotContactResponse): HubSpotContact {
  return {
    id: response.id,
    email: response.properties?.email ?? '',
    firstname: response.properties?.firstname ?? '',
    lastname: response.properties?.lastname ?? '',
    phone: response.properties?.phone ?? '',
    company: response.properties?.company ?? '',
  };
}

function mapDeal(response: HubSpotDealResponse): HubSpotDeal {
  return {
    id: response.id,
    name: response.properties?.dealname ?? '(無題)',
    stage: response.properties?.dealstage ?? '',
    amount: response.properties?.amount ?? '',
    closeDate: response.properties?.closedate ?? '',
  };
}

export async function getHubSpotContact(email: string): Promise<HubSpotContact | null> {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    throw new IntegrationError('HubSpotで検索するメールアドレスを入力してください。');
  }

  const response = await fetchJson<HubSpotListResponse<HubSpotContactResponse>>(
    'https://api.hubapi.com/crm/v3/objects/contacts/search',
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: trimmedEmail,
              },
            ],
          },
        ],
        properties: ['email', 'firstname', 'lastname', 'phone', 'company'],
        limit: 1,
      }),
    },
    'HubSpotコンタクト検索に失敗しました。トークン、権限、メールアドレスを確認してください。'
  );

  const contact = response.results?.[0];
  return contact ? mapContact(contact) : null;
}

export async function createHubSpotContact(input: {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
}): Promise<HubSpotContact> {
  const email = input.email.trim();

  if (!email) {
    throw new IntegrationError('作成するコンタクトのメールアドレスを入力してください。');
  }

  const properties: Record<string, string> = {
    email,
  };

  for (const [key, value] of Object.entries({
    firstname: input.firstname?.trim(),
    lastname: input.lastname?.trim(),
    phone: input.phone?.trim(),
    company: input.company?.trim(),
  })) {
    if (value) {
      properties[key] = value;
    }
  }

  const response = await fetchJson<HubSpotContactResponse>(
    'https://api.hubapi.com/crm/v3/objects/contacts',
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ properties }),
    },
    'HubSpotコンタクト作成に失敗しました。トークン、権限、入力内容を確認してください。'
  );

  return mapContact(response);
}

export async function listHubSpotDeals(limit = 5): Promise<HubSpotDeal[]> {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 5;

  const response = await fetchJson<HubSpotListResponse<HubSpotDealResponse>>(
    `https://api.hubapi.com/crm/v3/objects/deals?limit=${normalizedLimit}&properties=dealname,dealstage,amount,closedate`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'HubSpot deal一覧の取得に失敗しました。トークンと権限を確認してください。'
  );

  return (response.results ?? []).map(mapDeal);
}
