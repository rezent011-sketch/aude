import { IntegrationError } from './errors';

const VONAGE_API_BASE_URL = 'https://rest.nexmo.com';

type VonageSendResponse = {
  messages?: Array<{
    'message-id'?: string;
    status?: string;
    'error-text'?: string;
  }>;
};

type VonageBalanceResponse = {
  value?: number;
  auto_reload?: boolean;
};

function normalizeCredential(value: string, name: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Vonageの${name}が設定されていません。`);
  }

  return trimmed;
}

function normalizeText(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Vonageの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractVonageErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const firstMessage = Array.isArray((payload as VonageSendResponse).messages)
    ? (payload as VonageSendResponse).messages?.[0]
    : null;
  const errorText = firstMessage?.['error-text'];

  return typeof errorText === 'string' && errorText.trim() ? errorText : null;
}

async function vonageRequest<T>(
  path: string,
  options: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${VONAGE_API_BASE_URL}${path}`, options);
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractVonageErrorMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function sendSms(
  apiKey: string,
  apiSecret: string,
  from: string,
  to: string,
  text: string
): Promise<{ messageId: string; status: string }> {
  const payload = await vonageRequest<VonageSendResponse>(
    '/sms/json',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: normalizeCredential(apiKey, 'API key'),
        api_secret: normalizeCredential(apiSecret, 'API secret'),
        from: normalizeText(from, 'from'),
        to: normalizeText(to, 'to'),
        text: normalizeText(text, 'message'),
      }),
    },
    'VonageのSMS送信に失敗しました。'
  );

  const firstMessage = payload.messages?.[0];

  return {
    messageId: typeof firstMessage?.['message-id'] === 'string' ? firstMessage['message-id'] : '',
    status: typeof firstMessage?.status === 'string' ? firstMessage.status : '',
  };
}

export async function getBalance(
  apiKey: string,
  apiSecret: string
): Promise<{ value: number; autoReload: boolean }> {
  const normalizedApiKey = normalizeCredential(apiKey, 'API key');
  const normalizedApiSecret = normalizeCredential(apiSecret, 'API secret');
  const payload = await vonageRequest<VonageBalanceResponse>(
    `/account/get-balance?api_key=${encodeURIComponent(normalizedApiKey)}&api_secret=${encodeURIComponent(normalizedApiSecret)}`,
    {
      method: 'GET',
    },
    'Vonageの残高取得に失敗しました。'
  );

  return {
    value: typeof payload.value === 'number' ? payload.value : 0,
    autoReload: payload.auto_reload === true,
  };
}
