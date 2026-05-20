import { IntegrationError } from './errors';

const FREEE_API_BASE_URL = 'https://api.freee.co.jp/api/1';

type FreeeListResponse<T> = {
  [key: string]: unknown;
} & Partial<Record<string, T[]>>;

type FreeeCreateDealResponse = {
  deal?: {
    id?: number;
    issue_date?: string;
    type?: 'income' | 'expense';
    amount?: number;
  };
  message?: string;
  errors?: Array<{ messages?: string[] }>;
};

function normalizeAccessToken(accessToken: string): string {
  const trimmed = accessToken.trim();

  if (!trimmed) {
    throw new IntegrationError('Freeeのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeCompanyId(companyId: number): number {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new IntegrationError('Freeeのcompany IDは正の整数で指定してください。');
  }

  return companyId;
}

function extractFreeeMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as {
    message?: unknown;
    errors?: Array<{ messages?: unknown }>;
  };

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message;
  }

  if (Array.isArray(record.errors)) {
    const messages = record.errors
      .flatMap((error) => (Array.isArray(error.messages) ? error.messages : []))
      .filter(
        (message): message is string =>
          typeof message === 'string' && Boolean(message.trim())
      );

    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  return null;
}

async function freeeRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${FREEE_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizeAccessToken(accessToken)}`,
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
    const apiMessage = extractFreeeMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

function getArrayProperty<T>(payload: unknown, key: string): T[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const value = (payload as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function getCompanies(
  accessToken: string
): Promise<{ id: number; name: string; role: string; display_name: string }[]> {
  type Company = {
    id?: number;
    name?: string;
    role?: string;
    display_name?: string;
  };

  const payload = await freeeRequest<FreeeListResponse<Company>>(
    '/companies',
    accessToken,
    { method: 'GET' },
    'Freeeのcompany一覧取得に失敗しました。'
  );

  return getArrayProperty<Company>(payload, 'companies').map((company) => ({
    id: typeof company.id === 'number' ? company.id : 0,
    name: typeof company.name === 'string' && company.name.trim() ? company.name : '(No name)',
    role: typeof company.role === 'string' && company.role.trim() ? company.role : 'unknown',
    display_name:
      typeof company.display_name === 'string' && company.display_name.trim()
        ? company.display_name
        : '(No display name)',
  }));
}

export async function listDeals(
  accessToken: string,
  companyId: number
): Promise<
  {
    id: number;
    issue_date: string;
    type: 'income' | 'expense';
    amount: number;
    due_amount: number;
    status: string;
    partner_name: string;
  }[]
> {
  type Deal = {
    id?: number;
    issue_date?: string;
    type?: 'income' | 'expense';
    amount?: number;
    due_amount?: number;
    status?: string;
    partner_name?: string | null;
  };

  const searchParams = new URLSearchParams({
    company_id: String(normalizeCompanyId(companyId)),
    limit: '20',
  });

  const payload = await freeeRequest<FreeeListResponse<Deal>>(
    `/deals?${searchParams.toString()}`,
    accessToken,
    { method: 'GET' },
    'Freeeのdeal一覧取得に失敗しました。'
  );

  return getArrayProperty<Deal>(payload, 'deals').map((deal) => ({
    id: typeof deal.id === 'number' ? deal.id : 0,
    issue_date: typeof deal.issue_date === 'string' ? deal.issue_date : 'unknown',
    type: deal.type === 'expense' ? 'expense' : 'income',
    amount: typeof deal.amount === 'number' ? deal.amount : 0,
    due_amount: typeof deal.due_amount === 'number' ? deal.due_amount : 0,
    status: typeof deal.status === 'string' && deal.status.trim() ? deal.status : 'unknown',
    partner_name:
      typeof deal.partner_name === 'string' && deal.partner_name.trim()
        ? deal.partner_name
        : '未設定',
  }));
}

export async function createDeal(
  accessToken: string,
  companyId: number,
  params: {
    issue_date: string;
    type: 'income' | 'expense';
    details: {
      account_item_id: number;
      tax_code: number;
      amount: number;
      description?: string;
    }[];
    partner_id?: number;
  }
): Promise<{ id: number; issue_date: string; type: 'income' | 'expense'; amount: number }> {
  const issueDate = params.issue_date.trim();

  if (!issueDate) {
    throw new IntegrationError('Freeeのissue_dateを指定してください。');
  }

  if (!Array.isArray(params.details) || params.details.length === 0) {
    throw new IntegrationError('Freeeのdeal detailsを1件以上指定してください。');
  }

  const payload = {
    company_id: normalizeCompanyId(companyId),
    issue_date: issueDate,
    type: params.type,
    details: params.details.map((detail) => ({
      account_item_id: detail.account_item_id,
      tax_code: detail.tax_code,
      amount: detail.amount,
      ...(detail.description?.trim() ? { description: detail.description.trim() } : {}),
    })),
    ...(typeof params.partner_id === 'number' ? { partner_id: params.partner_id } : {}),
  };

  const response = await freeeRequest<FreeeCreateDealResponse>(
    '/deals',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    'Freeeのdeal作成に失敗しました。'
  );

  const deal = response.deal;
  if (!deal || typeof deal.id !== 'number' || typeof deal.issue_date !== 'string' || !deal.type) {
    throw new IntegrationError('Freee APIレスポンスの形式が不正です。');
  }

  return {
    id: deal.id,
    issue_date: deal.issue_date,
    type: deal.type,
    amount: typeof deal.amount === 'number' ? deal.amount : 0,
  };
}

export async function listPartners(
  accessToken: string,
  companyId: number
): Promise<{ id: number; name: string; code: string; email: string }[]> {
  type Partner = {
    id?: number;
    name?: string;
    code?: string | null;
    email?: string | null;
  };

  const searchParams = new URLSearchParams({
    company_id: String(normalizeCompanyId(companyId)),
    limit: '20',
  });

  const payload = await freeeRequest<FreeeListResponse<Partner>>(
    `/partners?${searchParams.toString()}`,
    accessToken,
    { method: 'GET' },
    'Freeeのpartner一覧取得に失敗しました。'
  );

  return getArrayProperty<Partner>(payload, 'partners').map((partner) => ({
    id: typeof partner.id === 'number' ? partner.id : 0,
    name: typeof partner.name === 'string' && partner.name.trim() ? partner.name : '(No name)',
    code: typeof partner.code === 'string' && partner.code.trim() ? partner.code : '未設定',
    email: typeof partner.email === 'string' && partner.email.trim() ? partner.email : '未設定',
  }));
}

export async function listAccountItems(
  accessToken: string,
  companyId: number
): Promise<{ id: number; name: string; shortcut1: string }[]> {
  type AccountItem = {
    id?: number;
    name?: string;
    shortcut1?: string | null;
  };

  const searchParams = new URLSearchParams({
    company_id: String(normalizeCompanyId(companyId)),
    base_date: '',
  });

  const payload = await freeeRequest<FreeeListResponse<AccountItem>>(
    `/account_items?${searchParams.toString()}`,
    accessToken,
    { method: 'GET' },
    'Freeeのaccount item一覧取得に失敗しました。'
  );

  return getArrayProperty<AccountItem>(payload, 'account_items').map((accountItem) => ({
    id: typeof accountItem.id === 'number' ? accountItem.id : 0,
    name:
      typeof accountItem.name === 'string' && accountItem.name.trim()
        ? accountItem.name
        : '(No name)',
    shortcut1:
      typeof accountItem.shortcut1 === 'string' && accountItem.shortcut1.trim()
        ? accountItem.shortcut1
        : '未設定',
  }));
}
