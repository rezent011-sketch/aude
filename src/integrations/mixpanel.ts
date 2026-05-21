import { Buffer } from 'node:buffer';
import { IntegrationError } from './errors';

const MIXPANEL_API_BASE_URL = 'https://mixpanel.com/api/query';

type MixpanelTopEventsResponse = {
  data?: {
    series?: Record<string, Record<string, unknown>>;
  };
  error?: string;
};

type MixpanelFunnelsResponse = Array<{
  funnel_id?: number;
  name?: string;
}>;

function normalizeCredential(value: string, name: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Mixpanelの${name}が設定されていません。`);
  }

  return trimmed;
}

function normalizeProjectId(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError('Mixpanelのproject_idを指定してください。');
  }

  return trimmed;
}

function buildAuthorizationHeader(username: string, secret: string): string {
  const normalizedUsername = normalizeCredential(username, 'service account');
  const normalizedSecret = normalizeCredential(secret, 'secret');
  return `Basic ${Buffer.from(`${normalizedUsername}:${normalizedSecret}`).toString('base64')}`;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  return typeof error === 'string' && error.trim() ? error : null;
}

async function mixpanelRequest<T>(
  path: string,
  username: string,
  secret: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${MIXPANEL_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: buildAuthorizationHeader(username, secret),
        Accept: 'application/json',
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

export async function getTopEvents(
  username: string,
  secret: string,
  projectId: string
): Promise<Array<{ event: string; count: number }>> {
  const normalizedProjectId = normalizeProjectId(projectId);
  const payload = await mixpanelRequest<MixpanelTopEventsResponse>(
    `/events/top?project_id=${encodeURIComponent(normalizedProjectId)}&type=general&unit=day&interval=7`,
    username,
    secret,
    'Mixpanelのイベント集計取得に失敗しました。'
  );

  return Object.entries(payload.data?.series ?? {})
    .map(([event, byDate]) => ({
      event,
      count: Object.values(byDate).reduce<number>(
        (sum, value) => sum + (typeof value === 'number' ? value : 0),
        0
      ),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export async function getFunnels(
  username: string,
  secret: string,
  projectId: string
): Promise<Array<{ funnel_id: number; name: string }>> {
  const normalizedProjectId = normalizeProjectId(projectId);
  const payload = await mixpanelRequest<MixpanelFunnelsResponse>(
    `/funnels/list?project_id=${encodeURIComponent(normalizedProjectId)}`,
    username,
    secret,
    'Mixpanelのファネル一覧取得に失敗しました。'
  );

  return (payload ?? []).map((funnel) => ({
    funnel_id: typeof funnel.funnel_id === 'number' ? funnel.funnel_id : 0,
    name: typeof funnel.name === 'string' && funnel.name.trim() ? funnel.name : '(No name)',
  }));
}
