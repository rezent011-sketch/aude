import { IntegrationError } from './errors';
import { fetchJson } from './http';

const ASANA_API_BASE_URL = 'https://app.asana.com/api/1.0';

type AsanaListResponse<T> = {
  data?: T[];
};

type AsanaItemResponse = {
  data?: {
    gid?: string;
    name?: string;
  };
};

type AsanaWorkspace = {
  gid?: string;
  name?: string;
};

type AsanaTask = {
  gid?: string;
  name?: string;
  completed?: boolean;
  due_on?: string | null;
};

function getHeaders(token: string): Record<string, string> {
  const normalized = token.trim();

  if (!normalized) {
    throw new IntegrationError('Asanaアクセストークンが設定されていません。');
  }

  return {
    Authorization: `Bearer ${normalized}`,
    'Content-Type': 'application/json',
  };
}

export async function getWorkspaces(
  token: string
): Promise<Array<{ gid: string; name: string }>> {
  const response = await fetchJson<AsanaListResponse<AsanaWorkspace>>(
    `${ASANA_API_BASE_URL}/workspaces`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Asanaのワークスペース一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((workspace) => ({
    gid: typeof workspace.gid === 'string' ? workspace.gid : '',
    name: typeof workspace.name === 'string' && workspace.name.trim() ? workspace.name : '(No name)',
  }));
}

export async function getMyTasks(
  token: string,
  workspaceGid: string
): Promise<Array<{ gid: string; name: string; completed: boolean; due_on: string | null }>> {
  const normalizedWorkspaceGid = workspaceGid.trim();

  if (!normalizedWorkspaceGid) {
    throw new IntegrationError('Asanaのworkspace_idを指定してください。');
  }

  const params = new URLSearchParams({
    workspace: normalizedWorkspaceGid,
    assignee: 'me',
    opt_fields: 'gid,name,completed,due_on',
    limit: '20',
  });

  const response = await fetchJson<AsanaListResponse<AsanaTask>>(
    `${ASANA_API_BASE_URL}/tasks?${params.toString()}`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Asanaの自分のタスク一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((task) => ({
    gid: typeof task.gid === 'string' ? task.gid : '',
    name: typeof task.name === 'string' && task.name.trim() ? task.name : '(No name)',
    completed: task.completed === true,
    due_on: typeof task.due_on === 'string' ? task.due_on : null,
  }));
}

export async function createTask(
  token: string,
  workspaceGid: string,
  name: string,
  notes?: string
): Promise<{ gid: string; name: string }> {
  const normalizedWorkspaceGid = workspaceGid.trim();
  const normalizedName = name.trim();

  if (!normalizedWorkspaceGid) {
    throw new IntegrationError('Asanaのworkspace_idを指定してください。');
  }

  if (!normalizedName) {
    throw new IntegrationError('Asanaのnameを指定してください。');
  }

  const response = await fetchJson<AsanaItemResponse>(
    `${ASANA_API_BASE_URL}/tasks`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        data: {
          workspace: normalizedWorkspaceGid,
          name: normalizedName,
          notes: notes?.trim() ?? '',
        },
      }),
    },
    'Asanaのタスク作成に失敗しました。'
  );

  return {
    gid: typeof response.data?.gid === 'string' ? response.data.gid : '',
    name: typeof response.data?.name === 'string' ? response.data.name : normalizedName,
  };
}
