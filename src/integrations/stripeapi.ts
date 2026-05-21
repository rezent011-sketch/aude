import { IntegrationError } from './errors';

const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';

type StripeListCustomersResponse = {
  data?: Array<{
    id?: string;
    name?: string | null;
    email?: string | null;
    created?: number;
  }>;
  error?: {
    message?: string;
  };
};

type StripeListPaymentsResponse = {
  data?: Array<{
    id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    created?: number;
    receipt_email?: string | null;
  }>;
  error?: {
    message?: string;
  };
};

type StripePaymentLinkResponse = {
  id?: string;
  url?: string;
  error?: {
    message?: string;
  };
};

function normalizeSecretKey(secretKey: string): string {
  const trimmed = secretKey.trim();

  if (!trimmed) {
    throw new IntegrationError('Stripeのsecret keyが設定されていません。');
  }

  return trimmed;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number') {
    return 20;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new IntegrationError('Stripeのlimitは正の整数で指定してください。');
  }

  return limit;
}

function normalizePriceId(priceId: string): string {
  const trimmed = priceId.trim();

  if (!trimmed) {
    throw new IntegrationError('Stripeのprice_idを指定してください。');
  }

  return trimmed;
}

function normalizeQuantity(quantity: number | undefined): number {
  if (typeof quantity !== 'number') {
    return 1;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new IntegrationError('Stripeのquantityは正の整数で指定してください。');
  }

  return quantity;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { error?: { message?: unknown } }).error?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function stripeRequest<T>(
  path: string,
  secretKey: string,
  options: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${STRIPE_API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${normalizeSecretKey(secretKey)}`,
        ...(options.headers ?? {}),
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

export async function listCustomers(
  secretKey: string,
  limit?: number
): Promise<Array<{ id: string; name: string; email: string; created: number }>> {
  const response = await stripeRequest<StripeListCustomersResponse>(
    `/customers?limit=${normalizeLimit(limit)}`,
    secretKey,
    {
      method: 'GET',
    },
    'Stripeの顧客一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((customer) => ({
    id: typeof customer.id === 'string' ? customer.id : '',
    name: typeof customer.name === 'string' ? customer.name : '',
    email: typeof customer.email === 'string' ? customer.email : '',
    created: typeof customer.created === 'number' ? customer.created : 0,
  }));
}

export async function listPayments(
  secretKey: string,
  limit?: number
): Promise<
  Array<{ id: string; amount: number; currency: string; status: string; created: number; customer_email: string }>
> {
  const response = await stripeRequest<StripeListPaymentsResponse>(
    `/payment_intents?limit=${normalizeLimit(limit)}`,
    secretKey,
    {
      method: 'GET',
    },
    'Stripeの支払い一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((payment) => ({
    id: typeof payment.id === 'string' ? payment.id : '',
    amount: typeof payment.amount === 'number' ? payment.amount : 0,
    currency: typeof payment.currency === 'string' ? payment.currency : '',
    status: typeof payment.status === 'string' ? payment.status : '',
    created: typeof payment.created === 'number' ? payment.created : 0,
    customer_email: typeof payment.receipt_email === 'string' ? payment.receipt_email : '',
  }));
}

export async function createPaymentLink(
  secretKey: string,
  priceId: string,
  quantity?: number
): Promise<{ id: string; url: string }> {
  const response = await stripeRequest<StripePaymentLinkResponse>(
    '/payment_links',
    secretKey,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'line_items[0][price]': normalizePriceId(priceId),
        'line_items[0][quantity]': String(normalizeQuantity(quantity)),
      }).toString(),
    },
    'Stripeの決済リンク作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    url: typeof response.url === 'string' ? response.url : '',
  };
}
