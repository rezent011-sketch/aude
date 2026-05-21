import { IntegrationError } from './errors';

const LAUNCHDARKLY_API_BASE_URL = 'https://app.launchdarkly.com/api/v2';

type LaunchDarklyProjectsResponse = {
  items?: Array<{
    key?: string;
    name?: string;
  }>;
};

type LaunchDarklyFlagsResponse = {
  items?: Array<{
    key?: string;
    name?: string;
    kind?: string;
    environments?: {
      production?: {
        on?: boolean;
      } | null;
    } | null;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('LaunchDarklyのAPI Tokenが設定されていません。');
  }

  return trimmed;
}

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return null;
}

async function launchDarklyRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${LAUNCHDARKLY_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: normalizeToken(token),
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const apiMessage = extractApiError(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getProjects(token: string): Promise<Array<{ key: string; name: string }>> {
  const response = await launchDarklyRequest<LaunchDarklyProjectsResponse>(
    '/projects',
    token,
    { method: 'GET' },
    'LaunchDarklyのproject一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((project) => ({
    key: typeof project.key === 'string' && project.key.trim() ? project.key : '(No key)',
    name: typeof project.name === 'string' && project.name.trim() ? project.name : '(No name)',
  }));
}

export async function getFlags(
  token: string,
  projectKey: string
): Promise<Array<{ key: string; name: string; kind: string; on: boolean }>> {
  const normalizedProjectKey = projectKey.trim();

  if (!normalizedProjectKey) {
    throw new IntegrationError('LaunchDarklyのproject_keyを指定してください。');
  }

  const response = await launchDarklyRequest<LaunchDarklyFlagsResponse>(
    `/flags/${encodeURIComponent(normalizedProjectKey)}`,
    token,
    { method: 'GET' },
    'LaunchDarklyのflag一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((flag) => ({
    key: typeof flag.key === 'string' && flag.key.trim() ? flag.key : '(No key)',
    name: typeof flag.name === 'string' && flag.name.trim() ? flag.name : '(No name)',
    kind: typeof flag.kind === 'string' && flag.kind.trim() ? flag.kind : 'unknown',
    on: flag.environments?.production?.on === true,
  }));
}

export async function toggleFlag(
  token: string,
  projectKey: string,
  flagKey: string,
  enabled: boolean
): Promise<void> {
  const normalizedProjectKey = projectKey.trim();
  const normalizedFlagKey = flagKey.trim();

  if (!normalizedProjectKey || !normalizedFlagKey) {
    throw new IntegrationError('LaunchDarklyのproject_keyとflag_keyを指定してください。');
  }

  await launchDarklyRequest<unknown>(
    `/flags/${encodeURIComponent(normalizedProjectKey)}/${encodeURIComponent(normalizedFlagKey)}`,
    token,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; domain-model=launchdarkly.semanticpatch',
      },
      body: JSON.stringify({
        environmentKey: 'production',
        instructions: [
          {
            kind: enabled ? 'turnFlagOn' : 'turnFlagOff',
          },
        ],
      }),
    },
    `LaunchDarklyのflagを${enabled ? '有効化' : '無効化'}できませんでした。`
  );
}
