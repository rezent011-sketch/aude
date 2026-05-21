import { IntegrationError } from './errors';

const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1';

type StripeBillingErrorResponse = {
  error?: {
    message?: string;
  };
};

type StripeSubscriptionsResponse = {
  data?: Array<{
    id?: string;
    status?: string;
    current_period_end?: number;
    customer?: string;
    plan?: {
      amount?: number;
      currency?: string;
    };
  }>;
};

type StripeInvoicesResponse = {
  data?: Array<{
    id?: string;
    customer_email?: string | null;
    amount_due?: number;
    status?: string;
    created?: number;
  }>;
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

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as StripeBillingErrorResponse).error?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function stripeBillingRequest<T>(
  path: string,
  secretKey: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${STRIPE_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeSecretKey(secretKey)}`,
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

export async function listSubscriptions(
  secretKey: string,
  limit?: number
): Promise<
  Array<{
    id: string;
    status: string;
    current_period_end: number;
    customer: string;
    plan_amount: number;
    plan_currency: string;
  }>
> {
  const response = await stripeBillingRequest<StripeSubscriptionsResponse>(
    `/subscriptions?limit=${normalizeLimit(limit)}`,
    secretKey,
    { method: 'GET' },
    'Stripeのサブスクリプション一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((subscription) => ({
    id: typeof subscription.id === 'string' ? subscription.id : '',
    status: typeof subscription.status === 'string' ? subscription.status : '',
    current_period_end:
      typeof subscription.current_period_end === 'number' ? subscription.current_period_end : 0,
    customer: typeof subscription.customer === 'string' ? subscription.customer : '',
    plan_amount: typeof subscription.plan?.amount === 'number' ? subscription.plan.amount : 0,
    plan_currency:
      typeof subscription.plan?.currency === 'string' ? subscription.plan.currency : '',
  }));
}

export async function listInvoices(
  secretKey: string,
  limit?: number
): Promise<
  Array<{
    id: string;
    customer_email: string;
    amount_due: number;
    status: string;
    created: number;
  }>
> {
  const response = await stripeBillingRequest<StripeInvoicesResponse>(
    `/invoices?limit=${normalizeLimit(limit)}`,
    secretKey,
    { method: 'GET' },
    'Stripeの請求書一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((invoice) => ({
    id: typeof invoice.id === 'string' ? invoice.id : '',
    customer_email: typeof invoice.customer_email === 'string' ? invoice.customer_email : '',
    amount_due: typeof invoice.amount_due === 'number' ? invoice.amount_due : 0,
    status: typeof invoice.status === 'string' ? invoice.status : '',
    created: typeof invoice.created === 'number' ? invoice.created : 0,
  }));
}
