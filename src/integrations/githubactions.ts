import { IntegrationError } from './errors';
import { fetchJson } from './http';

const GITHUB_API_BASE_URL = 'https://api.github.com';

type WorkflowResponse = {
  id: number;
  name: string;
  state: string;
  path: string;
};

type WorkflowRunResponse = {
  id: number;
  name?: string;
  display_title?: string;
  status?: string;
  conclusion?: string | null;
  created_at?: string;
  html_url?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('GitHub Tokenが設定されていません。');
  }

  return trimmed;
}

function parseRepository(owner: string, repo: string): { owner: string; repo: string } {
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim();

  if (!normalizedOwner || !normalizedRepo) {
    throw new IntegrationError('GitHubリポジトリは owner/repo を指定してください。');
  }

  return {
    owner: normalizedOwner,
    repo: normalizedRepo,
  };
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: `token ${normalizeToken(token)}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'aude-discord-bot',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export async function listWorkflows(
  token: string,
  owner: string,
  repo: string
): Promise<Array<{ id: number; name: string; state: string; path: string }>> {
  const repository = parseRepository(owner, repo);
  const response = await fetchJson<{ workflows?: WorkflowResponse[] }>(
    `${GITHUB_API_BASE_URL}/repos/${repository.owner}/${repository.repo}/actions/workflows`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'GitHub Actionsのワークフロー一覧取得に失敗しました。'
  );

  return (response.workflows ?? []).map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    state: workflow.state,
    path: workflow.path,
  }));
}

export async function listRuns(
  token: string,
  owner: string,
  repo: string,
  workflowId?: number
): Promise<
  Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    created_at: string;
    html_url: string;
  }>
> {
  const repository = parseRepository(owner, repo);
  const path = workflowId
    ? `/repos/${repository.owner}/${repository.repo}/actions/workflows/${workflowId}/runs?per_page=10`
    : `/repos/${repository.owner}/${repository.repo}/actions/runs?per_page=10`;
  const response = await fetchJson<{ workflow_runs?: WorkflowRunResponse[] }>(
    `${GITHUB_API_BASE_URL}${path}`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'GitHub Actionsの実行履歴取得に失敗しました。'
  );

  return (response.workflow_runs ?? []).map((run) => ({
    id: run.id,
    name: run.name ?? run.display_title ?? '(No name)',
    status: run.status ?? '',
    conclusion: run.conclusion ?? null,
    created_at: run.created_at ?? '',
    html_url: run.html_url ?? '',
  }));
}

export async function triggerWorkflow(
  token: string,
  owner: string,
  repo: string,
  workflowId: number | string,
  ref?: string
): Promise<void> {
  const repository = parseRepository(owner, repo);
  const normalizedWorkflowId = String(workflowId).trim();

  if (!normalizedWorkflowId) {
    throw new IntegrationError('GitHub Actionsのworkflow_idを指定してください。');
  }

  let response: Response;

  try {
    response = await fetch(
      `${GITHUB_API_BASE_URL}/repos/${repository.owner}/${repository.repo}/actions/workflows/${encodeURIComponent(
        normalizedWorkflowId
      )}/dispatches`,
      {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({
          ref: ref?.trim() || 'main',
        }),
      }
    );
  } catch (error) {
    throw new IntegrationError('GitHub Actionsのワークフロー実行に失敗しました。', {
      cause: error,
    });
  }

  if (response.status !== 204) {
    const body = await response.text().catch(() => '');
    throw new IntegrationError(
      body
        ? `GitHub Actionsのワークフロー実行に失敗しました。 (${body.slice(0, 200)})`
        : 'GitHub Actionsのワークフロー実行に失敗しました。'
    );
  }
}
