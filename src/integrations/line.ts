import { IntegrationError } from './errors';

const BASE_URL = 'https://api.line.me/v2/bot';

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse(res: Response): Promise<unknown> {
  if (!res.ok) {
    let msg = `LINE API error: ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = `LINE API error: ${body.message}`;
    } catch {
      // ignore
    }
    throw new IntegrationError(msg);
  }
  if (res.status === 204) return {};
  return res.json();
}

export async function pushMessage(token: string, to: string, text: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/message/push`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  await handleResponse(res);
}

export async function broadcastMessage(token: string, text: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/message/broadcast`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  });
  await handleResponse(res);
}

export async function getProfile(
  token: string,
  userId: string
): Promise<{ displayName: string; pictureUrl: string; statusMessage: string }> {
  const res = await fetch(`${BASE_URL}/profile/${userId}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res) as Promise<{ displayName: string; pictureUrl: string; statusMessage: string }>;
}

export async function getFollowerIds(token: string): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/followers/ids`, {
    headers: authHeaders(token),
  });
  const data = (await handleResponse(res)) as { userIds: string[] };
  return data.userIds ?? [];
}

export async function replyMessage(
  token: string,
  replyToken: string,
  text: string
): Promise<void> {
  const res = await fetch(`${BASE_URL}/message/reply`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
  await handleResponse(res);
}

export async function getBotInfo(
  token: string
): Promise<{ displayName: string; pictureUrl: string; chatMode: string }> {
  const res = await fetch(`${BASE_URL}/info`, {
    headers: authHeaders(token),
  });
  return handleResponse(res) as Promise<{ displayName: string; pictureUrl: string; chatMode: string }>;
}
