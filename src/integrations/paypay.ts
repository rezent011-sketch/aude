import { IntegrationError } from './errors';

const PAYPAY_API_BASE_URL = 'https://api.paypay.ne.jp';

type PayPayResponse<T> = {
  data?: T;
  resultInfo?: {
    message?: string;
    code?: string;
  };
};

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('PayPayのAPI Keyが設定されていません。');
  }

  return trimmed;
}

function normalizeApiSecret(apiSecret: string): string {
  const trimmed = apiSecret.trim();

  if (!trimmed) {
    throw new IntegrationError('PayPayのAPI Secretが設定されていません。');
  }

  return trimmed;
}

function buildHeaders(apiKey: string, apiSecret: string): Record<string, string> {
  return {
    Authorization: `hmac OPA-Auth ${normalizeApiKey(apiKey)}:${Buffer.from(
      normalizeApiSecret(apiSecret)
    ).toString('base64')}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const resultInfo = (payload as { resultInfo?: { message?: unknown; code?: unknown } }).resultInfo;
  const message = typeof resultInfo?.message === 'string' ? resultInfo.message.trim() : '';
  const code = typeof resultInfo?.code === 'string' ? resultInfo.code.trim() : '';

  if (message && code) {
    return `${code}: ${message}`;
  }

  return message || code || null;
}

async function paypayRequest<T>(
  path: string,
  init: RequestInit,
  apiKey: string,
  apiSecret: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${PAYPAY_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...buildHeaders(apiKey, apiSecret),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as PayPayResponse<T> | null;

  if (!response.ok) {
    const apiMessage = extractErrorMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  if (!payload?.data) {
    throw new IntegrationError('PayPay APIレスポンスの形式が不正です。');
  }

  return payload.data;
}

export async function createPayment(
  apiKey: string,
  apiSecret: string,
  merchantPaymentId: string,
  amount: number,
  description: string
): Promise<{ paymentUrl: string; merchantPaymentId: string }> {
  const normalizedPaymentId = merchantPaymentId.trim();
  const normalizedDescription = description.trim();

  if (!normalizedPaymentId) {
    throw new IntegrationError('PayPayのmerchantPaymentIdを指定してください。');
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new IntegrationError('PayPayのamountは正の整数で指定してください。');
  }

  if (!normalizedDescription) {
    throw new IntegrationError('PayPayのdescriptionを指定してください。');
  }

  const data = await paypayRequest<{ url?: string; merchantPaymentId?: string }>(
    '/v2/qrcode',
    {
      method: 'POST',
      body: JSON.stringify({
        merchantPaymentId: normalizedPaymentId,
        amount: {
          amount,
          currency: 'JPY',
        },
        orderDescription: normalizedDescription,
        codeType: 'ORDER_QR',
        isAuthorization: false,
      }),
    },
    apiKey,
    apiSecret,
    'PayPayの決済QRコード作成に失敗しました。'
  );

  return {
    paymentUrl: typeof data.url === 'string' ? data.url : '',
    merchantPaymentId:
      typeof data.merchantPaymentId === 'string' ? data.merchantPaymentId : normalizedPaymentId,
  };
}

export async function getPaymentStatus(
  apiKey: string,
  apiSecret: string,
  merchantPaymentId: string
): Promise<{ status: string; amount: number }> {
  const normalizedPaymentId = merchantPaymentId.trim();

  if (!normalizedPaymentId) {
    throw new IntegrationError('PayPayのmerchantPaymentIdを指定してください。');
  }

  const data = await paypayRequest<{ status?: string; amount?: { amount?: number } }>(
    `/v2/qrcode/orders/${encodeURIComponent(normalizedPaymentId)}`,
    {
      method: 'GET',
    },
    apiKey,
    apiSecret,
    'PayPayの決済状態取得に失敗しました。'
  );

  return {
    status: typeof data.status === 'string' && data.status.trim() ? data.status : 'UNKNOWN',
    amount: typeof data.amount?.amount === 'number' ? data.amount.amount : 0,
  };
}
