import { IntegrationError } from './errors';

const SLACK_API_BASE_URL = 'https://slack.com/api';

type SlackChannelsResponse = {
  ok?: boolean;
  error?: string;
  channels?: Array<{
    id?: string;
    name?: string;
    is_private?: boolean;
  }>;
};

type SlackMessagesResponse = {
  ok?: boolean;
  error?: string;
  messages?: Array<{
    user?: string;
    text?: string;
    ts?: string;
  }>;
};

type SlackUserInfoResponse = {
  ok?: boolean;
  error?: string;
  user?: {
    name?: string;
    real_name?: string;
    profile?: {
      email?: string;
    };
  };
};

type SlackPostMessageResponse = {
  ok?: boolean;
  error?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Slack Bot Tokenが設定されていません。');
  }

  return trimmed;
}

function extractSlackError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === 'string' && error.trim() ? error : null;
}

async function slackRequest<T>(
  path: string,
  token: string,
  body: Record<string, unknown>,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${SLACK_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractSlackError(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getChannels(
  token: string
): Promise<Array<{ id: string; name: string; is_private: boolean }>> {
  const response = await slackRequest<SlackChannelsResponse>(
    '/conversations.list',
    token,
    {
      types: 'public_channel,private_channel',
      limit: 100,
    },
    'Slackのチャンネル一覧取得に失敗しました。'
  );

  if (!response.ok) {
    throw new IntegrationError(
      response.error ? `Slackのチャンネル一覧取得に失敗しました。 (${response.error})` : 'Slackのチャンネル一覧取得に失敗しました。'
    );
  }

  return (response.channels ?? []).map((channel) => ({
    id: typeof channel.id === 'string' ? channel.id : '',
    name: typeof channel.name === 'string' && channel.name.trim() ? channel.name : '(No name)',
    is_private: channel.is_private === true,
  }));
}

export async function sendMessage(token: string, channel: string, text: string): Promise<void> {
  const normalizedChannel = channel.trim();
  const normalizedText = text.trim();

  if (!normalizedChannel) {
    throw new IntegrationError('Slackのchannelを指定してください。');
  }

  if (!normalizedText) {
    throw new IntegrationError('Slackに送信するmessageを指定してください。');
  }

  const response = await slackRequest<SlackPostMessageResponse>(
    '/chat.postMessage',
    token,
    {
      channel: normalizedChannel,
      text: normalizedText,
    },
    'Slackへのメッセージ送信に失敗しました。'
  );

  if (!response.ok) {
    throw new IntegrationError(response.error || 'Slackへのメッセージ送信に失敗しました。');
  }
}

export async function getMessages(
  token: string,
  channel: string
): Promise<Array<{ user: string; text: string; ts: string }>> {
  const normalizedChannel = channel.trim();

  if (!normalizedChannel) {
    throw new IntegrationError('Slackのchannelを指定してください。');
  }

  const response = await slackRequest<SlackMessagesResponse>(
    '/conversations.history',
    token,
    {
      channel: normalizedChannel,
      limit: 10,
    },
    'Slackのメッセージ一覧取得に失敗しました。'
  );

  if (!response.ok) {
    throw new IntegrationError(
      response.error ? `Slackのメッセージ一覧取得に失敗しました。 (${response.error})` : 'Slackのメッセージ一覧取得に失敗しました。'
    );
  }

  return (response.messages ?? []).map((message) => ({
    user: typeof message.user === 'string' && message.user.trim() ? message.user : 'unknown',
    text: typeof message.text === 'string' ? message.text : '',
    ts: typeof message.ts === 'string' ? message.ts : '',
  }));
}

export async function getUserInfo(
  token: string,
  userId: string
): Promise<{ name: string; real_name: string; email: string }> {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new IntegrationError('Slackのuser IDを指定してください。');
  }

  const response = await slackRequest<SlackUserInfoResponse>(
    '/users.info',
    token,
    {
      user: normalizedUserId,
    },
    'Slackのユーザー情報取得に失敗しました。'
  );

  if (!response.ok) {
    throw new IntegrationError(
      response.error ? `Slackのユーザー情報取得に失敗しました。 (${response.error})` : 'Slackのユーザー情報取得に失敗しました。'
    );
  }

  return {
    name: typeof response.user?.name === 'string' ? response.user.name : '',
    real_name: typeof response.user?.real_name === 'string' ? response.user.real_name : '',
    email: typeof response.user?.profile?.email === 'string' ? response.user.profile.email : '',
  };
}
