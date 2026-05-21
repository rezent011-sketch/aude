import { IntegrationError } from './errors';

const INTERCOM_API_BASE_URL = 'https://api.intercom.io';
const INTERCOM_VERSION = '2.10';

type IntercomConversationsResponse = {
  conversations?: Array<{
    id?: string;
    source?: {
      subject?: string | null;
    };
    state?: string;
    created_at?: number;
    assignee?: {
      name?: string | null;
    } | null;
  }>;
};

type IntercomContactResponse = {
  id?: string;
  name?: string;
  email?: string;
  created_at?: number;
};

type IntercomReplyResponse = {
  type?: string;
};

function normalizeToken(token: string): string {
  const normalized = token.trim();

  if (!normalized) {
    throw new IntegrationError('Intercomのaccess tokenが設定されていません。');
  }

  return normalized;
}

async function intercomRequest<T>(
  token: string,
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${INTERCOM_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'Intercom-Version': INTERCOM_VERSION,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new IntegrationError(fallbackMessage);
  }

  return payload as T;
}

export async function getConversations(
  token: string
): Promise<
  Array<{
    id: string;
    subject: string;
    state: string;
    created_at: number;
    assignee_name: string;
  }>
> {
  const response = await intercomRequest<IntercomConversationsResponse>(
    token,
    '/conversations?per_page=20',
    {
      method: 'GET',
    },
    'Intercomの会話一覧取得に失敗しました。'
  );

  return (response.conversations ?? []).map((conversation) => ({
    id: typeof conversation.id === 'string' ? conversation.id : '',
    subject:
      typeof conversation.source?.subject === 'string' && conversation.source.subject.trim()
        ? conversation.source.subject
        : '(no subject)',
    state: typeof conversation.state === 'string' ? conversation.state : '',
    created_at: typeof conversation.created_at === 'number' ? conversation.created_at : 0,
    assignee_name:
      typeof conversation.assignee?.name === 'string' && conversation.assignee.name.trim()
        ? conversation.assignee.name
        : '未割当',
  }));
}

export async function getContact(
  token: string,
  id: string
): Promise<{ id: string; name: string; email: string; created_at: number }> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new IntegrationError('Intercomのcontact IDを指定してください。');
  }

  const response = await intercomRequest<IntercomContactResponse>(
    token,
    `/contacts/${normalizedId}`,
    {
      method: 'GET',
    },
    'Intercomのコンタクト取得に失敗しました。'
  );

  if (typeof response.id !== 'string' || !response.id.trim()) {
    throw new IntegrationError('Intercomのコンタクト取得に失敗しました。');
  }

  return {
    id: response.id,
    name: typeof response.name === 'string' ? response.name : '',
    email: typeof response.email === 'string' ? response.email : '',
    created_at: typeof response.created_at === 'number' ? response.created_at : 0,
  };
}

export async function sendMessage(
  token: string,
  conversationId: string,
  body: string
): Promise<void> {
  const normalizedConversationId = conversationId.trim();
  const normalizedBody = body.trim();

  if (!normalizedConversationId) {
    throw new IntegrationError('Intercomのconversation IDを指定してください。');
  }

  if (!normalizedBody) {
    throw new IntegrationError('Intercomに送信するmessageを指定してください。');
  }

  const response = await intercomRequest<IntercomReplyResponse>(
    token,
    `/conversations/${normalizedConversationId}/reply`,
    {
      method: 'POST',
      body: JSON.stringify({
        message_type: 'comment',
        type: 'admin',
        body: normalizedBody,
      }),
    },
    'Intercomへの返信に失敗しました。'
  );

  if (typeof response.type !== 'string' || !response.type.trim()) {
    throw new IntegrationError('Intercomへの返信に失敗しました。');
  }
}
