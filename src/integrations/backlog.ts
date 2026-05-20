import { IntegrationError } from './errors';

type BacklogProjectResponse = {
  id: number;
  projectKey: string;
  name: string;
  archived: boolean;
};

type BacklogIssueResponse = {
  id: number;
  issueKey: string;
  summary: string;
  status?: { name?: string | null } | null;
  assignee?: { name?: string | null } | null;
  priority?: { name?: string | null } | null;
};

type BacklogCreateIssueResponse = {
  id: number;
  issueKey: string;
};

type BacklogIssueTypeResponse = {
  id: number;
  name: string;
};

type BacklogPriorityResponse = {
  id: number;
  name: string;
};

function normalizeSpace(space: string): string {
  const trimmed = space.trim().replace(/^https?:\/\//, '').replace(/\.backlog\.com$/i, '').replace(/\/+$/, '');

  if (!trimmed) {
    throw new IntegrationError('Backlogのspaceが設定されていません。');
  }

  return trimmed;
}

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('BacklogのAPIキーが設定されていません。');
  }

  return trimmed;
}

function buildBaseUrl(space: string): string {
  return `https://${normalizeSpace(space)}.backlog.com/api/v2`;
}

function buildViewUrl(space: string, issueKey: string): string {
  return `https://${normalizeSpace(space)}.backlog.com/view/${issueKey}`;
}

async function backlogRequest<T>(
  apiKey: string,
  space: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = new URL(`${buildBaseUrl(space)}${path}`);

  if (!url.searchParams.has('apiKey')) {
    url.searchParams.set('apiKey', normalizeApiKey(apiKey));
  }

  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new IntegrationError('Backlog APIへの接続に失敗しました。', { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as
    | { errors?: Array<{ message?: string }> }
    | null;

  if (!response.ok) {
    const apiMessage = payload?.errors?.map((item) => item.message).filter(Boolean).join(', ');

    throw new IntegrationError(
      apiMessage
        ? `Backlog APIリクエストに失敗しました。(${apiMessage})`
        : 'Backlog APIリクエストに失敗しました。'
    );
  }

  return payload as T;
}

export async function listProjects(
  apiKey: string,
  space: string
): Promise<{ id: number; projectKey: string; name: string; archived: boolean }[]> {
  const projects = await backlogRequest<BacklogProjectResponse[]>(
    apiKey,
    space,
    '/projects'
  );

  return projects.map((project) => ({
    id: project.id,
    projectKey: project.projectKey,
    name: project.name,
    archived: project.archived,
  }));
}

export async function listIssues(
  apiKey: string,
  space: string,
  projectId?: number
): Promise<
  {
    id: number;
    issueKey: string;
    summary: string;
    status: string;
    assignee: string | null;
    priority: string | null;
    url: string;
  }[]
> {
  const params = new URLSearchParams({
    count: '20',
  });

  if (typeof projectId === 'number') {
    params.append('projectId[]', String(projectId));
  }

  const issues = await backlogRequest<BacklogIssueResponse[]>(
    apiKey,
    space,
    `/issues?${params.toString()}`
  );

  return issues.map((issue) => ({
    id: issue.id,
    issueKey: issue.issueKey,
    summary: issue.summary,
    status: issue.status?.name ?? 'Unknown',
    assignee: issue.assignee?.name ?? null,
    priority: issue.priority?.name ?? null,
    url: buildViewUrl(space, issue.issueKey),
  }));
}

export async function createIssue(
  apiKey: string,
  space: string,
  params: {
    projectId: number;
    summary: string;
    issueTypeId: number;
    priorityId?: number;
    description?: string;
  }
): Promise<{ id: number; issueKey: string; url: string }> {
  const body = new URLSearchParams({
    projectId: String(params.projectId),
    summary: params.summary.trim(),
    issueTypeId: String(params.issueTypeId),
  });

  if (typeof params.priorityId === 'number') {
    body.set('priorityId', String(params.priorityId));
  }

  if (params.description?.trim()) {
    body.set('description', params.description.trim());
  }

  const issue = await backlogRequest<BacklogCreateIssueResponse>(apiKey, space, '/issues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  });

  return {
    id: issue.id,
    issueKey: issue.issueKey,
    url: buildViewUrl(space, issue.issueKey),
  };
}

export async function listIssueTypes(
  apiKey: string,
  space: string,
  projectId: number
): Promise<{ id: number; name: string }[]> {
  const issueTypes = await backlogRequest<BacklogIssueTypeResponse[]>(
    apiKey,
    space,
    `/projects/${projectId}/issueTypes`
  );

  return issueTypes.map((issueType) => ({
    id: issueType.id,
    name: issueType.name,
  }));
}

export async function listPriorities(
  apiKey: string,
  space: string
): Promise<{ id: number; name: string }[]> {
  const priorities = await backlogRequest<BacklogPriorityResponse[]>(
    apiKey,
    space,
    '/priorities'
  );

  return priorities.map((priority) => ({
    id: priority.id,
    name: priority.name,
  }));
}
