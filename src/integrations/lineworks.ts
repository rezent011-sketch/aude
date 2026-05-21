import { IntegrationError } from './errors';

const LINEWORKS_API_BASE_URL = 'https://www.worksapis.com/v1.0';

type LineworksChannelResponse = {
  channelId?: string;
  channelName?: string;
  type?: string;
};

type LineworksMessageResponse = {
  messageId?: string;
  content?: {
    type?: string;
    text?: string;
  } | null;
  createdTime?: string;
};

function normalizeAccessToken(accessToken: string): string {
  const trimmed = accessToken.trim();

  if (!trimmed) {
    throw new IntegrationError('LINE WORKSのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeBotId(botId: string): string {
  const trimmed = botId.trim();

  if (!trimmed) {
    throw new IntegrationError('LINE WORKSのbot IDが設定されていません。');
  }

  return trimmed;
}

function buildLineworksUrl(botId: string, path: string): string {
  return `${LINEWORKS_API_BASE_URL}/bots/${encodeURIComponent(normalizeBotId(botId))}${path}`;
}

function buildHeaders(
  accessToken: string,
  extraHeaders?: Record<string, string>
): Record<string, string> {
  const headers = new Headers(extraHeaders);
  headers.set('Authorization', `Bearer ${normalizeAccessToken(accessToken)}`);
  headers.set('Accept', 'application/json');

  return Object.fromEntries(headers.entries());
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidateKeys = ['message', 'error', 'errorMessage'] as const;

  for (const key of candidateKeys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function lineworksRequest<T>(
  accessToken: string,
  botId: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildLineworksUrl(botId, path), {
      ...init,
      headers: buildHeaders(accessToken, init.headers as Record<string, string> | undefined),
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const apiMessage =
      typeof payload === 'string' && payload.trim() ? payload.trim() : extractErrorMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getChannels(
  accessToken: string,
  botId: string
): Promise<{ channelId: string; channelName: string; type: string }[]> {
  const response = await lineworksRequest<LineworksChannelResponse[]>(
    accessToken,
    botId,
    '/channels',
    { method: 'GET' },
    'LINE WORKSのchannel一覧取得に失敗しました。'
  );

  return response.map((channel) => ({
    channelId: typeof channel.channelId === 'string' ? channel.channelId : '',
    channelName:
      typeof channel.channelName === 'string' && channel.channelName.trim()
        ? channel.channelName
        : '(No name)',
    type: typeof channel.type === 'string' && channel.type.trim() ? channel.type : 'unknown',
  }));
}

export async function sendMessage(
  accessToken: string,
  botId: string,
  channelId: string,
  text: string
): Promise<void> {
  const normalizedChannelId = channelId.trim();
  const normalizedText = text.trim();

  if (!normalizedChannelId) {
    throw new IntegrationError('LINE WORKSのchannel IDを指定してください。');
  }

  if (!normalizedText) {
    throw new IntegrationError('送信するmessageを指定してください。');
  }

  await lineworksRequest<unknown>(
    accessToken,
    botId,
    `/channels/${encodeURIComponent(normalizedChannelId)}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          type: 'text',
          text: normalizedText,
        },
      }),
    },
    'LINE WORKSへのmessage送信に失敗しました。'
  );
}

export async function getMessages(
  accessToken: string,
  botId: string,
  channelId: string
): Promise<{ messageId: string; text: string; createdTime: string }[]> {
  const normalizedChannelId = channelId.trim();

  if (!normalizedChannelId) {
    throw new IntegrationError('LINE WORKSのchannel IDを指定してください。');
  }

  const response = await lineworksRequest<LineworksMessageResponse[]>(
    accessToken,
    botId,
    `/channels/${encodeURIComponent(normalizedChannelId)}/messages`,
    { method: 'GET' },
    'LINE WORKSのmessage一覧取得に失敗しました。'
  );

  return response.map((message) => ({
    messageId: typeof message.messageId === 'string' ? message.messageId : '',
    text:
      message.content?.type === 'text' && typeof message.content.text === 'string'
        ? message.content.text
        : '',
    createdTime:
      typeof message.createdTime === 'string' && message.createdTime.trim()
        ? message.createdTime
        : '',
  }));
}
