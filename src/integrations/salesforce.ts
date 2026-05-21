import { IntegrationError } from './errors';

const SALESFORCE_API_VERSION = 'v58.0';

type SalesforceQueryResponse = {
  records?: unknown[];
};

type SalesforceCreateLeadResponse = {
  id?: string;
  success?: boolean;
};

function normalizeToken(token: string): string {
  const normalized = token.trim();

  if (!normalized) {
    throw new IntegrationError('Salesforceのaccess tokenが設定されていません。');
  }

  return normalized;
}

function normalizeInstance(instance: string): string {
  const normalized = instance.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  if (!normalized) {
    throw new IntegrationError('Salesforceのinstance URLを設定してください。');
  }

  return normalized;
}

function normalizeString(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new IntegrationError(`Salesforceの${label}を指定してください。`);
  }

  return normalized;
}

function getBaseUrl(instance: string): string {
  return `https://${normalizeInstance(instance)}/services/data/${SALESFORCE_API_VERSION}`;
}

function extractMessage(payload: unknown): string | null {
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (entry && typeof entry === 'object') {
        const message = (entry as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }
    }
  }

  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return null;
}

async function salesforceRequest<T>(
  token: string,
  instance: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getBaseUrl(instance)}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
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

export async function query(
  token: string,
  instance: string,
  soql: string
): Promise<Array<Record<string, unknown>>> {
  const normalizedSoql = normalizeString(soql, 'SOQL');
  const response = await salesforceRequest<SalesforceQueryResponse>(
    token,
    instance,
    `/query?q=${encodeURIComponent(normalizedSoql)}`,
    {
      method: 'GET',
    },
    'Salesforceのクエリ実行に失敗しました。'
  );

  return (response.records ?? []).filter(
    (record): record is Record<string, unknown> => !!record && typeof record === 'object'
  );
}

export async function getAccounts(
  token: string,
  instance: string
): Promise<Array<{ Id: string; Name: string; Industry: string; AnnualRevenue: number }>> {
  const records = await query(
    token,
    instance,
    'SELECT Id, Name, Industry, AnnualRevenue FROM Account LIMIT 20'
  );

  return records.map((record) => ({
    Id: typeof record.Id === 'string' ? record.Id : '',
    Name: typeof record.Name === 'string' ? record.Name : '',
    Industry: typeof record.Industry === 'string' ? record.Industry : '',
    AnnualRevenue: typeof record.AnnualRevenue === 'number' ? record.AnnualRevenue : 0,
  }));
}

export async function getOpportunities(
  token: string,
  instance: string
): Promise<
  Array<{ Id: string; Name: string; StageName: string; Amount: number; CloseDate: string }>
> {
  const records = await query(
    token,
    instance,
    'SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT 20'
  );

  return records.map((record) => ({
    Id: typeof record.Id === 'string' ? record.Id : '',
    Name: typeof record.Name === 'string' ? record.Name : '',
    StageName: typeof record.StageName === 'string' ? record.StageName : '',
    Amount: typeof record.Amount === 'number' ? record.Amount : 0,
    CloseDate: typeof record.CloseDate === 'string' ? record.CloseDate : '',
  }));
}

export async function createLead(
  token: string,
  instance: string,
  firstName: string,
  lastName: string,
  company: string,
  email: string
): Promise<{ id: string; success: boolean }> {
  const normalizedLastName = normalizeString(lastName, 'last_name');
  const normalizedCompany = normalizeString(company, 'company');
  const normalizedEmail = normalizeString(email, 'email');
  const response = await salesforceRequest<SalesforceCreateLeadResponse>(
    token,
    instance,
    '/sobjects/Lead',
    {
      method: 'POST',
      body: JSON.stringify({
        FirstName: firstName.trim(),
        LastName: normalizedLastName,
        Company: normalizedCompany,
        Email: normalizedEmail,
      }),
    },
    'Salesforceのリード作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    success: response.success === true,
  };
}
