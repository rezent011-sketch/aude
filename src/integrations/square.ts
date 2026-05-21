import { IntegrationError } from './errors';

const SQUARE_API_BASE_URL = 'https://connect.squareup.com/v2';

type SquareListResponse<T> = {
  locations?: T[];
  transactions?: T[];
  invoice?: T;
  errors?: Array<{ detail?: string; code?: string }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Squareのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const errors = (payload as { errors?: Array<{ detail?: unknown; code?: unknown }> }).errors;
  if (!Array.isArray(errors)) {
    return null;
  }

  const messages = errors
    .map((error) => {
      const detail = typeof error.detail === 'string' ? error.detail.trim() : '';
      const code = typeof error.code === 'string' ? error.code.trim() : '';

      if (detail && code) {
        return `${code}: ${detail}`;
      }

      return detail || code;
    })
    .filter(Boolean);

  return messages.length > 0 ? messages.join(', ') : null;
}

async function squareRequest<T>(
  token: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${SQUARE_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizeToken(token)}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractErrorMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function listLocations(
  token: string
): Promise<Array<{ id: string; name: string; address: string }>> {
  type Location = {
    id?: string;
    name?: string;
    address?: {
      address_line_1?: string;
    } | null;
  };

  const response = await squareRequest<SquareListResponse<Location>>(
    token,
    '/locations',
    { method: 'GET' },
    'Squareの店舗一覧取得に失敗しました。'
  );

  return (response.locations ?? []).map((location) => ({
    id: typeof location.id === 'string' ? location.id : '',
    name: typeof location.name === 'string' && location.name.trim() ? location.name : '(No name)',
    address: typeof location.address?.address_line_1 === 'string' ? location.address.address_line_1 : '',
  }));
}

export async function listTransactions(
  token: string,
  locationId: string
): Promise<
  Array<{
    id: string;
    amount: number;
    currency: string;
    created_at: string;
    status: string;
  }>
> {
  const normalizedLocationId = locationId.trim();

  if (!normalizedLocationId) {
    throw new IntegrationError('Squareのlocation_idを指定してください。');
  }

  type Transaction = {
    id?: string;
    tenders?: Array<{
      amount_money?: {
        amount?: number;
        currency?: string;
      } | null;
    }>;
    created_at?: string;
    status?: string;
  };

  const response = await squareRequest<SquareListResponse<Transaction>>(
    token,
    `/locations/${encodeURIComponent(normalizedLocationId)}/transactions`,
    { method: 'GET' },
    'Squareの決済一覧取得に失敗しました。'
  );

  return (response.transactions ?? []).map((transaction) => ({
    id: typeof transaction.id === 'string' ? transaction.id : '',
    amount: typeof transaction.tenders?.[0]?.amount_money?.amount === 'number'
      ? transaction.tenders[0].amount_money.amount
      : 0,
    currency: typeof transaction.tenders?.[0]?.amount_money?.currency === 'string'
      ? transaction.tenders[0].amount_money.currency
      : '',
    created_at: typeof transaction.created_at === 'string' ? transaction.created_at : '',
    status: typeof transaction.status === 'string' && transaction.status.trim()
      ? transaction.status
      : 'UNKNOWN',
  }));
}

export async function createInvoice(
  token: string,
  locationId: string,
  amount: number,
  description: string
): Promise<{ id: string; status: string }> {
  const normalizedLocationId = locationId.trim();
  const normalizedDescription = description.trim();

  if (!normalizedLocationId) {
    throw new IntegrationError('Squareのlocation_idを指定してください。');
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new IntegrationError('Squareのamountは正の整数で指定してください。');
  }

  if (!normalizedDescription) {
    throw new IntegrationError('Squareのdescriptionを指定してください。');
  }

  type Invoice = {
    id?: string;
    status?: string;
  };

  const response = await squareRequest<SquareListResponse<Invoice>>(
    token,
    '/invoices',
    {
      method: 'POST',
      body: JSON.stringify({
        invoice: {
          location_id: normalizedLocationId,
          primary_recipient: {},
          payment_requests: [
            {
              request_type: 'BALANCE',
              due_date: new Date().toISOString().split('T')[0],
              fixed_amount_requested_money: {
                amount,
                currency: 'JPY',
              },
            },
          ],
          description: normalizedDescription,
        },
      }),
    },
    'Squareの請求書作成に失敗しました。'
  );

  return {
    id: typeof response.invoice?.id === 'string' ? response.invoice.id : '',
    status:
      typeof response.invoice?.status === 'string' && response.invoice.status.trim()
        ? response.invoice.status
        : 'UNKNOWN',
  };
}
