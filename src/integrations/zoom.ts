import { IntegrationError } from './errors';

const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';
const ZOOM_OAUTH_TOKEN_URL = 'https://zoom.us/oauth/token';

type ZoomAccessTokenResponse = {
  access_token?: string;
  error?: string;
  reason?: string;
};

type ZoomMeetingResponse = {
  id: number;
  topic: string;
  start_url?: string;
  join_url?: string;
  start_time?: string;
  duration?: number;
  agenda?: string;
};

function normalizeCredential(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`${label}が設定されていません。`);
  }

  return trimmed;
}

function buildBearerHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeCredential(token, 'Zoomアクセストークン')}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function parseZoomError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; reason?: string; error?: string }
    | null;

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload?.reason === 'string' && payload.reason.trim()) {
    return payload.reason.trim();
  }

  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }

  const text = await response.text().catch(() => '');
  return text.trim();
}

async function zoomRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${ZOOM_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...buildBearerHeaders(token),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError('Zoom APIへの接続に失敗しました。', { cause: error });
  }

  if (!response.ok) {
    const apiMessage = await parseZoomError(response);
    throw new IntegrationError(
      apiMessage
        ? `Zoom APIリクエストに失敗しました。(${apiMessage})`
        : 'Zoom APIリクエストに失敗しました。'
    );
  }

  return (await response.json()) as T;
}

export async function getAccessToken(
  accountId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const normalizedAccountId = normalizeCredential(accountId, 'Zoom account ID');
  const normalizedClientId = normalizeCredential(clientId, 'Zoom client ID');
  const normalizedClientSecret = normalizeCredential(clientSecret, 'Zoom client secret');

  let response: Response;

  try {
    response = await fetch(
      `${ZOOM_OAUTH_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(
        normalizedAccountId
      )}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${normalizedClientId}:${normalizedClientSecret}`
          ).toString('base64')}`,
          Accept: 'application/json',
        },
      }
    );
  } catch (error) {
    throw new IntegrationError('Zoom OAuthトークンの取得に失敗しました。', { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as ZoomAccessTokenResponse | null;

  if (!response.ok || !payload?.access_token) {
    const apiMessage =
      payload?.reason?.trim() || payload?.error?.trim() || 'アクセストークンを取得できませんでした。';
    throw new IntegrationError(`Zoom OAuthトークンの取得に失敗しました。(${apiMessage})`);
  }

  return payload.access_token;
}

export async function createMeeting(
  token: string,
  userId: string,
  params: { topic: string; duration?: number; start_time?: string; agenda?: string }
): Promise<{ id: number; topic: string; start_url: string; join_url: string; start_time: string }> {
  const meeting = await zoomRequest<ZoomMeetingResponse>(
    token,
    `/users/${encodeURIComponent(userId)}/meetings`,
    {
      method: 'POST',
      body: JSON.stringify({
        topic: params.topic.trim(),
        type: 2,
        duration: params.duration ?? 30,
        start_time: params.start_time,
        agenda: params.agenda,
        settings: {
          host_video: true,
          participant_video: true,
        },
      }),
    }
  );

  return {
    id: meeting.id,
    topic: meeting.topic,
    start_url: meeting.start_url ?? '',
    join_url: meeting.join_url ?? '',
    start_time: meeting.start_time ?? '',
  };
}

export async function listMeetings(
  token: string,
  userId: string
): Promise<{ id: number; topic: string; start_time: string; duration: number; join_url: string }[]> {
  const meetings = await zoomRequest<{ meetings?: ZoomMeetingResponse[] }>(
    token,
    `/users/${encodeURIComponent(userId)}/meetings?type=scheduled`,
    {
      method: 'GET',
    }
  );

  return (meetings.meetings ?? []).map((meeting) => ({
    id: meeting.id,
    topic: meeting.topic,
    start_time: meeting.start_time ?? '',
    duration: meeting.duration ?? 0,
    join_url: meeting.join_url ?? '',
  }));
}

export async function getMeeting(
  token: string,
  meetingId: string
): Promise<{ id: number; topic: string; start_time: string; duration: number; join_url: string; agenda: string }> {
  const meeting = await zoomRequest<ZoomMeetingResponse>(
    token,
    `/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: 'GET',
    }
  );

  return {
    id: meeting.id,
    topic: meeting.topic,
    start_time: meeting.start_time ?? '',
    duration: meeting.duration ?? 0,
    join_url: meeting.join_url ?? '',
    agenda: meeting.agenda ?? '',
  };
}
