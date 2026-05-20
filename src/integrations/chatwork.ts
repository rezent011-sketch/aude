import { IntegrationError } from './errors';

const CHATWORK_API_BASE_URL = 'https://api.chatwork.com/v2';

type ChatworkAccountResponse = {
  account_id: number;
  name: string;
  chatwork_id?: string;
  organization_id?: number;
  organization_name?: string;
  department?: string;
  title?: string;
  url?: string;
  introduction?: string;
  mail?: string;
};

type ChatworkRoomResponse = {
  room_id: number;
  name: string;
  type: string;
  unread_num: number;
};

type ChatworkMessageResponse = {
  message_id: string;
  account?: {
    name?: string;
  } | null;
  body: string;
  send_time: number;
};

type ChatworkTaskResponse = {
  task_ids: number[];
};

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('ChatworkのAPIキーが設定されていません。');
  }

  return trimmed;
}

function buildHeaders(
  apiKey: string,
  extraHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'X-ChatWorkToken': normalizeApiKey(apiKey),
    Accept: 'application/json',
    ...extraHeaders,
  };
}

async function parseChatworkError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { errors?: string[]; message?: string }
    | null;

  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    return payload.errors.join(', ');
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  const text = await response.text().catch(() => '');
  return text.trim();
}

async function chatworkRequest<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${CHATWORK_API_BASE_URL}${path}`, {
      ...init,
      headers: buildHeaders(apiKey, init?.headers as Record<string, string> | undefined),
    });
  } catch (error) {
    throw new IntegrationError('Chatwork APIへの接続に失敗しました。', { cause: error });
  }

  if (!response.ok) {
    const apiMessage = await parseChatworkError(response);
    throw new IntegrationError(
      apiMessage
        ? `Chatwork APIリクエストに失敗しました。(${apiMessage})`
        : 'Chatwork APIリクエストに失敗しました。'
    );
  }

  return (await response.json()) as T;
}

export async function getMe(
  apiKey: string
): Promise<{ account_id: number; name: string; email: string }> {
  const me = await chatworkRequest<ChatworkAccountResponse>(apiKey, '/me', {
    method: 'GET',
  });

  return {
    account_id: me.account_id,
    name: me.name,
    email: me.mail ?? '',
  };
}

export async function getRooms(
  apiKey: string
): Promise<{ room_id: number; name: string; type: string; unread_num: number }[]> {
  const rooms = await chatworkRequest<ChatworkRoomResponse[]>(apiKey, '/rooms', {
    method: 'GET',
  });

  return rooms.map((room) => ({
    room_id: room.room_id,
    name: room.name,
    type: room.type,
    unread_num: room.unread_num,
  }));
}

export async function sendMessage(
  apiKey: string,
  roomId: number,
  message: string
): Promise<{ message_id: string }> {
  const body = new URLSearchParams({
    body: message.trim(),
  });

  return chatworkRequest<{ message_id: string }>(apiKey, `/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  });
}

export async function getMessages(
  apiKey: string,
  roomId: number,
  force = true
): Promise<{ message_id: string; account: { name: string }; body: string; send_time: number }[]> {
  const params = new URLSearchParams();

  if (force) {
    params.set('force', '1');
  }

  const path = `/rooms/${roomId}/messages${params.toString() ? `?${params.toString()}` : ''}`;
  const messages = await chatworkRequest<ChatworkMessageResponse[]>(apiKey, path, {
    method: 'GET',
  });

  return messages.map((message) => ({
    message_id: message.message_id,
    account: {
      name: message.account?.name ?? 'unknown',
    },
    body: message.body,
    send_time: message.send_time,
  }));
}

export async function createTask(
  apiKey: string,
  roomId: number,
  params: { body: string; to_ids: number[]; limit?: number }
): Promise<{ task_id: number[] }> {
  if (params.to_ids.length === 0) {
    throw new IntegrationError('Chatwork task作成には少なくとも1つのto_idが必要です。');
  }

  const body = new URLSearchParams({
    body: params.body.trim(),
    to_ids: params.to_ids.join(','),
  });

  if (typeof params.limit === 'number') {
    body.set('limit', String(params.limit));
  }

  const result = await chatworkRequest<ChatworkTaskResponse>(apiKey, `/rooms/${roomId}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  });

  return {
    task_id: result.task_ids,
  };
}
