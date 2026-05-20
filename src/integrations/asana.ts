import { IntegrationError } from './errors';

const ASANA_API_BASE_URL = 'https://app.asana.com/api/1.0';

type AsanaListResponse<T> = {
  data?: T[];
  errors?: Array<{ message?: string }>;
};

type AsanaSingleResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type AsanaWorkspaceResponse = {
  gid: string;
  name: string;
};

type AsanaProjectResponse = {
  gid: string;
  name: string;
  archived: boolean;
  permalink_url: string | null;
};

type AsanaTaskResponse = {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
  assignee?: { name?: string | null } | null;
  permalink_url: string | null;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Asanaのtokenが設定されていません。');
  }

  return trimmed;
}

async function asanaRequest<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${ASANA_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError('Asana APIへの接続に失敗しました。', { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as
    | AsanaListResponse<T>
    | AsanaSingleResponse<T>
    | null;

  if (!response.ok) {
    const apiMessage = payload?.errors?.map((item) => item.message).filter(Boolean).join(', ');

    throw new IntegrationError(
      apiMessage
        ? `Asana APIリクエストに失敗しました。(${apiMessage})`
        : 'Asana APIリクエストに失敗しました。'
    );
  }

  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
    return payload.data as T;
  }

  throw new IntegrationError('Asana APIレスポンスの形式が不正です。');
}

export async function getWorkspaces(
  token: string
): Promise<{ gid: string; name: string }[]> {
  const workspaces = await asanaRequest<AsanaWorkspaceResponse[]>('/workspaces', token);

  return workspaces.map((workspace) => ({
    gid: workspace.gid,
    name: workspace.name,
  }));
}

export async function getProjects(
  token: string,
  workspaceGid: string
): Promise<{ gid: string; name: string; archived: boolean; permalink_url: string | null }[]> {
  const trimmedWorkspaceGid = workspaceGid.trim();

  if (!trimmedWorkspaceGid) {
    throw new IntegrationError('Asanaのworkspace IDを指定してください。');
  }

  const projects = await asanaRequest<AsanaProjectResponse[]>(
    `/projects?workspace=${encodeURIComponent(trimmedWorkspaceGid)}&limit=20`,
    token
  );

  return projects.map((project) => ({
    gid: project.gid,
    name: project.name,
    archived: project.archived,
    permalink_url: project.permalink_url,
  }));
}

export async function getTasks(
  token: string,
  projectGid: string
): Promise<
  {
    gid: string;
    name: string;
    completed: boolean;
    due_on: string | null;
    assignee: string | null;
    permalink_url: string | null;
  }[]
> {
  const trimmedProjectGid = projectGid.trim();

  if (!trimmedProjectGid) {
    throw new IntegrationError('Asanaのproject IDを指定してください。');
  }

  const tasks = await asanaRequest<AsanaTaskResponse[]>(
    `/tasks?project=${encodeURIComponent(trimmedProjectGid)}&opt_fields=gid,name,completed,due_on,assignee.name,permalink_url&limit=20`,
    token
  );

  return tasks.map((task) => ({
    gid: task.gid,
    name: task.name,
    completed: task.completed,
    due_on: task.due_on,
    assignee: task.assignee?.name ?? null,
    permalink_url: task.permalink_url,
  }));
}

export async function createTask(
  token: string,
  params: {
    workspace: string;
    name: string;
    notes?: string;
    due_on?: string;
    projects?: string[];
  }
): Promise<{ gid: string; name: string; permalink_url: string | null }> {
  const workspace = params.workspace.trim();
  const name = params.name.trim();

  if (!workspace) {
    throw new IntegrationError('Asanaのworkspace IDを指定してください。');
  }

  if (!name) {
    throw new IntegrationError('Asana task名を指定してください。');
  }

  const payload: {
    workspace: string;
    name: string;
    notes?: string;
    due_on?: string;
    projects?: string[];
  } = {
    workspace,
    name,
  };

  if (params.notes?.trim()) {
    payload.notes = params.notes.trim();
  }

  if (params.due_on?.trim()) {
    payload.due_on = params.due_on.trim();
  }

  const projects = params.projects?.map((project) => project.trim()).filter(Boolean);
  if (projects && projects.length > 0) {
    payload.projects = projects;
  }

  const task = await asanaRequest<AsanaTaskResponse>('/tasks', token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: payload,
    }),
  });

  return {
    gid: task.gid,
    name: task.name,
    permalink_url: task.permalink_url,
  };
}

export async function completeTask(
  token: string,
  taskGid: string
): Promise<{ gid: string; name: string; completed: boolean }> {
  const trimmedTaskGid = taskGid.trim();

  if (!trimmedTaskGid) {
    throw new IntegrationError('Asanaのtask IDを指定してください。');
  }

  const task = await asanaRequest<AsanaTaskResponse>(
    `/tasks/${encodeURIComponent(trimmedTaskGid)}`,
    token,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          completed: true,
        },
      }),
    }
  );

  return {
    gid: task.gid,
    name: task.name,
    completed: task.completed,
  };
}
