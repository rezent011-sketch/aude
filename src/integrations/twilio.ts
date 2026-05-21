import { Buffer } from 'node:buffer';
import { IntegrationError } from './errors';

const TWILIO_API_BASE_URL = 'https://api.twilio.com/2010-04-01';

type TwilioSendResponse = {
  sid?: string;
  status?: string;
  message?: string;
};

type TwilioMessagesResponse = {
  messages?: Array<{
    sid?: string;
    from?: string;
    to?: string;
    body?: string;
    status?: string;
    date_sent?: string;
  }>;
  message?: string;
};

function normalizeCredential(value: string, name: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Twilioの${name}が設定されていません。`);
  }

  return trimmed;
}

function normalizePhoneNumber(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Twilioの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function normalizeBody(body: string): string {
  const trimmed = body.trim();

  if (!trimmed) {
    throw new IntegrationError('Twilioに送信するmessageを指定してください。');
  }

  return trimmed;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();

  if (!trimmed) {
    throw new IntegrationError('Twilioのtwiml_urlを指定してください。');
  }

  return trimmed;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number') {
    return 20;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new IntegrationError('Twilioのlimitは正の整数で指定してください。');
  }

  return limit;
}

function buildAuthorizationHeader(accountSid: string, authToken: string): string {
  const sid = normalizeCredential(accountSid, 'account SID');
  const token = normalizeCredential(authToken, 'auth token');
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function twilioRequest<T>(
  path: string,
  options: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${TWILIO_API_BASE_URL}${path}`, options);
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

export async function sendSms(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<{ sid: string; status: string }> {
  const normalizedAccountSid = normalizeCredential(accountSid, 'account SID');
  const response = await twilioRequest<TwilioSendResponse>(
    `/Accounts/${encodeURIComponent(normalizedAccountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: buildAuthorizationHeader(accountSid, authToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: normalizePhoneNumber(from, 'from'),
        To: normalizePhoneNumber(to, 'to'),
        Body: normalizeBody(body),
      }).toString(),
    },
    'TwilioのSMS送信に失敗しました。'
  );

  return {
    sid: typeof response.sid === 'string' ? response.sid : '',
    status: typeof response.status === 'string' ? response.status : '',
  };
}

export async function getMessages(
  accountSid: string,
  authToken: string,
  limit?: number
): Promise<
  Array<{ sid: string; from: string; to: string; body: string; status: string; date_sent: string }>
> {
  const normalizedAccountSid = normalizeCredential(accountSid, 'account SID');
  const response = await twilioRequest<TwilioMessagesResponse>(
    `/Accounts/${encodeURIComponent(normalizedAccountSid)}/Messages.json?PageSize=${normalizeLimit(limit)}`,
    {
      method: 'GET',
      headers: {
        Authorization: buildAuthorizationHeader(accountSid, authToken),
      },
    },
    'Twilioのメッセージ一覧取得に失敗しました。'
  );

  return (response.messages ?? []).map((message) => ({
    sid: typeof message.sid === 'string' ? message.sid : '',
    from: typeof message.from === 'string' ? message.from : '',
    to: typeof message.to === 'string' ? message.to : '',
    body: typeof message.body === 'string' ? message.body : '',
    status: typeof message.status === 'string' ? message.status : '',
    date_sent: typeof message.date_sent === 'string' ? message.date_sent : '',
  }));
}

export async function makeCall(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  url: string
): Promise<{ sid: string; status: string }> {
  const normalizedAccountSid = normalizeCredential(accountSid, 'account SID');
  const response = await twilioRequest<TwilioSendResponse>(
    `/Accounts/${encodeURIComponent(normalizedAccountSid)}/Calls.json`,
    {
      method: 'POST',
      headers: {
        Authorization: buildAuthorizationHeader(accountSid, authToken),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: normalizePhoneNumber(from, 'from'),
        To: normalizePhoneNumber(to, 'to'),
        Url: normalizeUrl(url),
      }).toString(),
    },
    'Twilioの通話発信に失敗しました。'
  );

  return {
    sid: typeof response.sid === 'string' ? response.sid : '',
    status: typeof response.status === 'string' ? response.status : '',
  };
}
