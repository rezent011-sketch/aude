import { IntegrationError } from './errors';

const SEGMENT_API_BASE_URL = 'https://api.segmentapis.com';

type SegmentSourcesResponse = {
  data?: {
    sources?: Array<{
      id?: string;
      name?: string;
      slug?: string;
      enabled?: boolean;
    }>;
  };
  error?: string;
  message?: string;
};

type SegmentDestinationsResponse = {
  data?: {
    destinations?: Array<{
      id?: string;
      name?: string;
      enabled?: boolean;
      sourceId?: string;
    }>;
  };
  error?: string;
  message?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Segmentのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = (payload as { error?: unknown; message?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function segmentRequest<T>(path: string, token: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${SEGMENT_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
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

export async function getSources(
  token: string
): Promise<Array<{ id: string; name: string; slug: string; enabled: boolean }>> {
  const payload = await segmentRequest<SegmentSourcesResponse>(
    '/sources?pagination.count=20',
    token,
    'Segmentのソース一覧取得に失敗しました。'
  );

  return (payload.data?.sources ?? []).map((source) => ({
    id: typeof source.id === 'string' ? source.id : '',
    name: typeof source.name === 'string' && source.name.trim() ? source.name : '(No name)',
    slug: typeof source.slug === 'string' ? source.slug : '',
    enabled: source.enabled === true,
  }));
}

export async function getDestinations(
  token: string
): Promise<Array<{ id: string; name: string; enabled: boolean; sourceId: string }>> {
  const payload = await segmentRequest<SegmentDestinationsResponse>(
    '/destinations?pagination.count=20',
    token,
    'SegmentのDestination一覧取得に失敗しました。'
  );

  return (payload.data?.destinations ?? []).map((destination) => ({
    id: typeof destination.id === 'string' ? destination.id : '',
    name:
      typeof destination.name === 'string' && destination.name.trim()
        ? destination.name
        : '(No name)',
    enabled: destination.enabled === true,
    sourceId: typeof destination.sourceId === 'string' ? destination.sourceId : '',
  }));
}
