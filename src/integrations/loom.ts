import { IntegrationError } from './errors';

const LOOM_API_BASE_URL = 'https://www.loom.com/v1';

type LoomErrorResponse = {
  message?: string;
  error?: string;
};

type LoomVideosResponse = {
  videos?: Array<{
    id?: string;
    title?: string;
    duration?: number;
    created_at?: string;
    share_url?: string;
  }>;
};

type LoomVideoResponse = {
  id?: string;
  title?: string;
  duration?: number;
  view_count?: number;
  share_url?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Loomのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function normalizeValue(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Loomの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const objectPayload = payload as LoomErrorResponse;
  if (typeof objectPayload.message === 'string' && objectPayload.message.trim()) {
    return objectPayload.message;
  }

  return typeof objectPayload.error === 'string' && objectPayload.error.trim()
    ? objectPayload.error
    : null;
}

async function loomRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${LOOM_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...(init.headers ?? {}),
      },
    });
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

export async function getVideos(
  token: string
): Promise<
  Array<{ id: string; title: string; duration: number; created_at: string; share_url: string }>
> {
  const response = await loomRequest<LoomVideosResponse>(
    '/recordings?limit=20',
    token,
    { method: 'GET' },
    'Loomの動画一覧取得に失敗しました。'
  );

  return (response.videos ?? []).map((video) => ({
    id: typeof video.id === 'string' ? video.id : '',
    title: typeof video.title === 'string' && video.title.trim() ? video.title : '(No title)',
    duration: typeof video.duration === 'number' ? video.duration : 0,
    created_at: typeof video.created_at === 'string' ? video.created_at : '',
    share_url: typeof video.share_url === 'string' ? video.share_url : '',
  }));
}

export async function getVideo(
  token: string,
  videoId: string
): Promise<{ id: string; title: string; duration: number; view_count: number; share_url: string }> {
  const normalizedVideoId = normalizeValue(videoId, 'id');
  const response = await loomRequest<LoomVideoResponse>(
    `/recordings/${encodeURIComponent(normalizedVideoId)}`,
    token,
    { method: 'GET' },
    'Loomの動画情報取得に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    title: typeof response.title === 'string' && response.title.trim() ? response.title : '(No title)',
    duration: typeof response.duration === 'number' ? response.duration : 0,
    view_count: typeof response.view_count === 'number' ? response.view_count : 0,
    share_url: typeof response.share_url === 'string' ? response.share_url : '',
  };
}
