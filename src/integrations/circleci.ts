import { IntegrationError } from './errors';

const CIRCLECI_API_BASE_URL = 'https://circleci.com/api/v2';

type CircleCIErrorResponse = {
  message?: string;
};

type CircleCIPipelinesResponse = {
  items?: Array<{
    id?: string;
    number?: number;
    state?: string;
    created_at?: string;
    trigger_parameters?: Record<string, unknown>;
  }>;
};

type CircleCIWorkflowsResponse = {
  items?: Array<{
    id?: string;
    name?: string;
    status?: string;
    created_at?: string;
    stopped_at?: string | null;
  }>;
};

type CircleCITriggerPipelineResponse = {
  id?: string;
  number?: number;
  state?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('CircleCIのAPI tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeValue(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`CircleCIの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as CircleCIErrorResponse).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function circleCiRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${CIRCLECI_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Circle-Token': normalizeToken(token),
        'Content-Type': 'application/json; charset=utf-8',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getPipelines(
  token: string,
  orgSlug: string
): Promise<
  Array<{
    id: string;
    number: number;
    state: string;
    created_at: string;
    trigger_parameters?: Record<string, unknown>;
  }>
> {
  const normalizedOrgSlug = normalizeValue(orgSlug, 'org_slug');
  const response = await circleCiRequest<CircleCIPipelinesResponse>(
    `/project/${encodeURIComponent(normalizedOrgSlug)}/pipeline?per-page=10`,
    token,
    { method: 'GET' },
    'CircleCIのパイプライン一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((item) => ({
    id: typeof item.id === 'string' ? item.id : '',
    number: typeof item.number === 'number' ? item.number : 0,
    state: typeof item.state === 'string' ? item.state : '',
    created_at: typeof item.created_at === 'string' ? item.created_at : '',
    ...(item.trigger_parameters && typeof item.trigger_parameters === 'object'
      ? { trigger_parameters: item.trigger_parameters }
      : {}),
  }));
}

export async function getWorkflows(
  token: string,
  pipelineId: string
): Promise<
  Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
    stopped_at: string | null;
  }>
> {
  const normalizedPipelineId = normalizeValue(pipelineId, 'pipeline_id');
  const response = await circleCiRequest<CircleCIWorkflowsResponse>(
    `/pipeline/${encodeURIComponent(normalizedPipelineId)}/workflow`,
    token,
    { method: 'GET' },
    'CircleCIのワークフロー一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((item) => ({
    id: typeof item.id === 'string' ? item.id : '',
    name: typeof item.name === 'string' && item.name.trim() ? item.name : '(No name)',
    status: typeof item.status === 'string' ? item.status : '',
    created_at: typeof item.created_at === 'string' ? item.created_at : '',
    stopped_at: typeof item.stopped_at === 'string' || item.stopped_at === null ? item.stopped_at : null,
  }));
}

export async function triggerPipeline(
  token: string,
  orgSlug: string,
  branch?: string
): Promise<{ id: string; number: number; state: string }> {
  const normalizedOrgSlug = normalizeValue(orgSlug, 'org_slug');
  const normalizedBranch = branch?.trim() || 'main';
  const response = await circleCiRequest<CircleCITriggerPipelineResponse>(
    `/project/${encodeURIComponent(normalizedOrgSlug)}/pipeline`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        branch: normalizedBranch,
      }),
    },
    'CircleCIのパイプライン起動に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    number: typeof response.number === 'number' ? response.number : 0,
    state: typeof response.state === 'string' ? response.state : '',
  };
}
