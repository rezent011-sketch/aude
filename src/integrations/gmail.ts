import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

type GoogleTokenResponse = {
  access_token: string;
};

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailMessagePayload = {
  headers?: GmailHeader[];
  body?: {
    data?: string;
  };
  parts?: GmailMessagePayload[];
  mimeType?: string;
};

type GmailMessageSummaryResponse = {
  id: string;
  threadId: string;
};

type GmailListMessagesResponse = {
  messages?: GmailMessageSummaryResponse[];
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePayload;
};

type GmailSendMessageResponse = {
  id: string;
  threadId: string;
  labelIds?: string[];
};

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string | null;
  snippet: string;
};

export type GmailMessageDetail = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string | null;
  snippet: string;
  body: string;
};

export type GmailSentMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
};

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));

  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getHeaderValue(headers: GmailHeader[] | undefined, name: string): string {
  const header = (headers ?? []).find((item) => item.name?.toLowerCase() === name.toLowerCase());
  return header?.value?.trim() || '不明';
}

function collectTextParts(payload?: GmailMessagePayload): string[] {
  if (!payload) {
    return [];
  }

  const parts = payload.parts ?? [];
  const currentBody =
    payload.body?.data && payload.mimeType?.startsWith('text/')
      ? decodeBase64Url(payload.body.data).trim()
      : '';
  const nestedBodies = parts.flatMap((part) => collectTextParts(part));

  return [currentBody, ...nestedBodies].filter((value) => value.length > 0);
}

async function getAccessToken(): Promise<string> {
  const clientId = requireEnvVar('GOOGLE_CLIENT_ID', 'Gmail');
  const clientSecret = requireEnvVar('GOOGLE_CLIENT_SECRET', 'Gmail');
  const refreshToken = requireEnvVar('GOOGLE_REFRESH_TOKEN', 'Gmail');

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetchJson<GoogleTokenResponse>(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
    'Gmailのアクセストークン取得に失敗しました。OAuth設定とリフレッシュトークンを確認してください。'
  );

  return response.access_token;
}

async function getHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function mapMessageDetail(message: GmailMessageResponse): GmailMessageDetail {
  const headers = message.payload?.headers;
  const bodies = collectTextParts(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    subject: getHeaderValue(headers, 'subject'),
    from: getHeaderValue(headers, 'from'),
    to: getHeaderValue(headers, 'to'),
    date: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    snippet: message.snippet?.trim() || '(抜粋なし)',
    body: bodies.join('\n\n').trim() || '(本文なし)',
  };
}

export async function searchGmailMessages(query: string): Promise<GmailMessageSummary[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new IntegrationError('Gmail検索クエリを入力してください。');
  }

  const params = new URLSearchParams({
    q: trimmedQuery,
    maxResults: '5',
  });

  const listResponse = await fetchJson<GmailListMessagesResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {
      method: 'GET',
      headers: await getHeaders(),
    },
    'Gmail検索に失敗しました。Gmail API の有効化とメール権限を確認してください。'
  );

  const messages = listResponse.messages ?? [];

  if (messages.length === 0) {
    return [];
  }

  const headers = await getHeaders();
  const details = await Promise.all(
    messages.map((message) =>
      fetchJson<GmailMessageResponse>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        {
          method: 'GET',
          headers,
        },
        'Gmailメッセージ詳細の取得に失敗しました。'
      )
    )
  );

  return details.map((message) => ({
    id: message.id,
    threadId: message.threadId,
    subject: getHeaderValue(message.payload?.headers, 'subject'),
    from: getHeaderValue(message.payload?.headers, 'from'),
    date: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    snippet: message.snippet?.trim() || '(抜粋なし)',
  }));
}

export async function readGmailMessage(messageId: string): Promise<GmailMessageDetail> {
  const trimmedMessageId = messageId.trim();

  if (!trimmedMessageId) {
    throw new IntegrationError('読むメールの message id を入力してください。');
  }

  const response = await fetchJson<GmailMessageResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(trimmedMessageId)}?format=full`,
    {
      method: 'GET',
      headers: await getHeaders(),
    },
    'Gmailメールの取得に失敗しました。message id と権限を確認してください。'
  );

  return mapMessageDetail(response);
}

export async function sendGmailMessage(to: string, subject: string, body: string): Promise<GmailSentMessage> {
  const trimmedTo = to.trim();
  const trimmedSubject = subject.trim();
  const normalizedBody = body.trim();

  if (!trimmedTo) {
    throw new IntegrationError('送信先メールアドレスを入力してください。');
  }

  if (!trimmedSubject) {
    throw new IntegrationError('メール件名を入力してください。');
  }

  if (!normalizedBody) {
    throw new IntegrationError('メール本文を入力してください。');
  }

  const rawMessage = ['To: ' + trimmedTo, 'Subject: ' + trimmedSubject, 'Content-Type: text/plain; charset=UTF-8', '', normalizedBody].join(
    '\r\n'
  );

  const response = await fetchJson<GmailSendMessageResponse>(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        raw: encodeBase64Url(rawMessage),
      }),
    },
    'Gmail送信に失敗しました。送信権限と入力内容を確認してください。'
  );

  return {
    id: response.id,
    threadId: response.threadId,
    labelIds: response.labelIds ?? [],
  };
}
