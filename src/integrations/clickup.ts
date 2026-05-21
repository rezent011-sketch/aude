import { IntegrationError } from './errors';

const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2';

type ClickUpSpacesResponse = {
  spaces?: Array<{
    id?: string;
    name?: string;
  }>;
};

type ClickUpTasksResponse = {
  tasks?: Array<{
    id?: string;
    name?: string;
    status?: {
      status?: string;
    };
    assignees?: Array<{
      username?: string;
    }>;
    due_date?: string | null;
  }>;
};

type ClickUpTaskResponse = {
  id?: string;
  name?: string;
  url?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('ClickUp APIトークンが設定されていません。');
  }

  return trimmed;
}

function normalizeRequired(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`ClickUpの${label}を指定してください。`);
  }

  return trimmed;
}

async function clickupRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${CLICKUP_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: normalizeToken(token),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { err?: string; error?: string })
    | null;

  if (!response.ok) {
    const apiMessage =
      typeof payload?.err === 'string' && payload.err.trim()
        ? payload.err
        : typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error
          : null;

    throw new IntegrationError(
      apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage
    );
  }

  return payload as T;
}

export async function getSpaces(
  token: string,
  teamId: string
): Promise<Array<{ id: string; name: string }>> {
  const normalizedTeamId = normalizeRequired(teamId, 'team_id');
  const response = await clickupRequest<ClickUpSpacesResponse>(
    `/team/${encodeURIComponent(normalizedTeamId)}/space`,
    token,
    { method: 'GET' },
    'ClickUpのスペース一覧取得に失敗しました。'
  );

  return (response.spaces ?? []).map((space) => ({
    id: typeof space.id === 'string' ? space.id : '',
    name: typeof space.name === 'string' && space.name.trim() ? space.name : '(No name)',
  }));
}

export async function getTasks(
  token: string,
  listId: string
): Promise<Array<{ id: string; name: string; status: string; assignees: string[]; due_date: string | null }>> {
  const normalizedListId = normalizeRequired(listId, 'list_id');
  const response = await clickupRequest<ClickUpTasksResponse>(
    `/list/${encodeURIComponent(normalizedListId)}/task`,
    token,
    { method: 'GET' },
    'ClickUpのタスク一覧取得に失敗しました。'
  );

  return (response.tasks ?? []).map((task) => ({
    id: typeof task.id === 'string' ? task.id : '',
    name: typeof task.name === 'string' && task.name.trim() ? task.name : '(No name)',
    status:
      typeof task.status?.status === 'string' && task.status.status.trim()
        ? task.status.status
        : '-',
    assignees: (task.assignees ?? [])
      .map((assignee) => (typeof assignee.username === 'string' ? assignee.username : ''))
      .filter((username) => username.length > 0),
    due_date: typeof task.due_date === 'string' && task.due_date.trim() ? task.due_date : null,
  }));
}

export async function createTask(
  token: string,
  listId: string,
  name: string,
  description?: string
): Promise<{ id: string; name: string; url: string }> {
  const normalizedListId = normalizeRequired(listId, 'list_id');
  const normalizedName = normalizeRequired(name, 'name');
  const response = await clickupRequest<ClickUpTaskResponse>(
    `/list/${encodeURIComponent(normalizedListId)}/task`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: normalizedName,
        description: description?.trim() ?? '',
      }),
    },
    'ClickUpのタスク作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    name:
      typeof response.name === 'string' && response.name.trim() ? response.name : normalizedName,
    url: typeof response.url === 'string' ? response.url : '',
  };
}
