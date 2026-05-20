import { IntegrationError } from './errors';

const GITLAB_URL = (process.env.GITLAB_URL ?? 'https://gitlab.com').replace(/\/+$/, '');

type GitLabProjectResponse = {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  star_count?: number;
};

type GitLabUserResponse = {
  name?: string;
  username?: string;
};

type GitLabMergeRequestResponse = {
  iid: number;
  title: string;
  state: string;
  web_url: string;
  author?: GitLabUserResponse;
};

type GitLabIssueResponse = {
  iid: number;
  title: string;
  state: string;
  web_url: string;
  author?: GitLabUserResponse;
};

type GitLabCreateResponse = {
  iid: number;
  title: string;
  web_url: string;
};

export type GitLabProjectSummary = {
  id: number;
  name: string;
  path: string;
  url: string;
  stars: number;
};

export type GitLabMergeRequestSummary = {
  id: number;
  title: string;
  state: string;
  author: string;
  url: string;
};

export type GitLabIssueSummary = {
  id: number;
  title: string;
  state: string;
  author: string;
  url: string;
};

export type GitLabCreatedItem = {
  id: number;
  title: string;
  url: string;
};

function requireToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('GitLabトークンが設定されていません。');
  }

  return trimmed;
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'PRIVATE-TOKEN': requireToken(token),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function gitlabRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${GITLAB_URL}${path}`, {
      ...init,
      headers: {
        ...buildHeaders(token),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError('GitLab APIへの接続に失敗しました。', { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as
    | { message?: string | string[] | Record<string, string[]> }
    | null;

  if (!response.ok) {
    let apiMessage = '';

    if (typeof payload?.message === 'string') {
      apiMessage = payload.message;
    } else if (Array.isArray(payload?.message)) {
      apiMessage = payload.message.join(', ');
    } else if (payload?.message && typeof payload.message === 'object') {
      apiMessage = Object.entries(payload.message)
        .map(([key, value]) => `${key}: ${value.join(', ')}`)
        .join('; ');
    }

    throw new IntegrationError(
      apiMessage
        ? `GitLab APIリクエストに失敗しました。(${apiMessage})`
        : 'GitLab APIリクエストに失敗しました。'
    );
  }

  return payload as T;
}

function formatAuthor(author?: GitLabUserResponse): string {
  return author?.name ?? author?.username ?? 'unknown';
}

export async function listProjects(
  token: string,
  search?: string
): Promise<GitLabProjectSummary[]> {
  const params = new URLSearchParams({
    membership: 'true',
    per_page: '20',
    ...(search ? { search } : {}),
  });
  const projects = await gitlabRequest<GitLabProjectResponse[]>(
    token,
    `/api/v4/projects?${params.toString()}`,
    { method: 'GET' }
  );

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    path: project.path_with_namespace,
    url: project.web_url,
    stars: project.star_count ?? 0,
  }));
}

export async function listMergeRequests(
  token: string,
  projectId: string
): Promise<GitLabMergeRequestSummary[]> {
  const mergeRequests = await gitlabRequest<GitLabMergeRequestResponse[]>(
    token,
    `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests?per_page=20`,
    { method: 'GET' }
  );

  return mergeRequests.map((mergeRequest) => ({
    id: mergeRequest.iid,
    title: mergeRequest.title,
    state: mergeRequest.state,
    author: formatAuthor(mergeRequest.author),
    url: mergeRequest.web_url,
  }));
}

export async function createMergeRequest(
  token: string,
  projectId: string,
  params: {
    title: string;
    sourceBranch: string;
    targetBranch: string;
    description?: string;
  }
): Promise<GitLabCreatedItem> {
  const mergeRequest = await gitlabRequest<GitLabCreateResponse>(
    token,
    `/api/v4/projects/${encodeURIComponent(projectId)}/merge_requests`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: params.title,
        source_branch: params.sourceBranch,
        target_branch: params.targetBranch,
        description: params.description,
      }),
    }
  );

  return {
    id: mergeRequest.iid,
    title: mergeRequest.title,
    url: mergeRequest.web_url,
  };
}

export async function listIssues(
  token: string,
  projectId: string
): Promise<GitLabIssueSummary[]> {
  const issues = await gitlabRequest<GitLabIssueResponse[]>(
    token,
    `/api/v4/projects/${encodeURIComponent(projectId)}/issues?per_page=20`,
    { method: 'GET' }
  );

  return issues.map((issue) => ({
    id: issue.iid,
    title: issue.title,
    state: issue.state,
    author: formatAuthor(issue.author),
    url: issue.web_url,
  }));
}

export async function createIssue(
  token: string,
  projectId: string,
  params: {
    title: string;
    description?: string;
  }
): Promise<GitLabCreatedItem> {
  const issue = await gitlabRequest<GitLabCreateResponse>(
    token,
    `/api/v4/projects/${encodeURIComponent(projectId)}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: params.title,
        description: params.description,
      }),
    }
  );

  return {
    id: issue.iid,
    title: issue.title,
    url: issue.web_url,
  };
}
