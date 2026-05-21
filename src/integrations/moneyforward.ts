import { IntegrationError } from './errors';

const MONEYFORWARD_API_BASE_URL = 'https://invoice.moneyforward.com/api/v3';

type MoneyForwardOfficeResponse = {
  data?: Array<{
    office?: {
      id?: string;
      name?: string;
    };
  }>;
};

type MoneyForwardBillingResponse = {
  data?: Array<{
    billing?: {
      id?: string;
      title?: string;
      payment_status?: string;
      total_price_including_tax?: number;
    };
  }>;
};

type MoneyForwardExpenseResponse = {
  data?: Array<{
    expense_application?: {
      id?: string;
      title?: string;
      amount?: number;
      status?: string;
    };
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Money Forwardのアクセストークンが設定されていません。');
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

async function moneyforwardRequest<T>(path: string, token: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${MONEYFORWARD_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizeToken(token)}`,
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

export async function getOffices(token: string): Promise<Array<{ id: string; name: string }>> {
  const response = await moneyforwardRequest<MoneyForwardOfficeResponse>(
    '/offices',
    token,
    'Money Forwardの事業所一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((item) => ({
    id: typeof item.office?.id === 'string' ? item.office.id : '',
    name:
      typeof item.office?.name === 'string' && item.office.name.trim()
        ? item.office.name
        : '(No name)',
  }));
}

export async function getInvoices(
  token: string,
  officeId: string
): Promise<Array<{ id: string; title: string; status: string; amount: number }>> {
  const normalizedOfficeId = officeId.trim();

  if (!normalizedOfficeId) {
    throw new IntegrationError('Money Forwardのoffice IDを指定してください。');
  }

  const response = await moneyforwardRequest<MoneyForwardBillingResponse>(
    `/offices/${encodeURIComponent(normalizedOfficeId)}/billings`,
    token,
    'Money Forwardの請求書一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((item) => ({
    id: typeof item.billing?.id === 'string' ? item.billing.id : '',
    title:
      typeof item.billing?.title === 'string' && item.billing.title.trim()
        ? item.billing.title
        : '(No title)',
    status:
      typeof item.billing?.payment_status === 'string' && item.billing.payment_status.trim()
        ? item.billing.payment_status
        : 'unknown',
    amount: typeof item.billing?.total_price_including_tax === 'number'
      ? item.billing.total_price_including_tax
      : 0,
  }));
}

export async function getExpenses(
  token: string,
  officeId: string
): Promise<Array<{ id: string; subject: string; amount: number; status: string }>> {
  const normalizedOfficeId = officeId.trim();

  if (!normalizedOfficeId) {
    throw new IntegrationError('Money Forwardのoffice IDを指定してください。');
  }

  const response = await moneyforwardRequest<MoneyForwardExpenseResponse>(
    `/offices/${encodeURIComponent(normalizedOfficeId)}/expense_applications`,
    token,
    'Money Forwardの経費申請一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((item) => ({
    id: typeof item.expense_application?.id === 'string' ? item.expense_application.id : '',
    subject:
      typeof item.expense_application?.title === 'string' && item.expense_application.title.trim()
        ? item.expense_application.title
        : '(No subject)',
    amount: typeof item.expense_application?.amount === 'number' ? item.expense_application.amount : 0,
    status:
      typeof item.expense_application?.status === 'string' && item.expense_application.status.trim()
        ? item.expense_application.status
        : 'unknown',
  }));
}
