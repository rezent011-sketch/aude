import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

type GitHubIssueResponse = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  user?: {
    login?: string;
  };
  pull_request?: unknown;
};

type CreateIssueResponse = {
  number: number;
  title: string;
  html_url: string;
};

export type GitHubIssueSummary = {
  number: number;
  title: string;
  url: string;
  state: string;
  author: string;
};

export type GitHubCreatedIssue = {
  number: number;
  title: string;
  url: string;
};

function parseRepository(input: string): { owner: string; repo: string } {
  const trimmed = input.trim();
  const parts = trimmed.split('/');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new IntegrationError(
      'GitHubリポジトリは `owner/repo` 形式で指定してください。例: `openai/openai-node`'
    );
  }

  return {
    owner: parts[0],
    repo: parts[1],
  };
}

function getHeaders(): Record<string, string> {
  const token = requireEnvVar('GITHUB_TOKEN', 'GitHub');

  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'aude-discord-bot',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export async function listRepositoryIssues(repository: string): Promise<GitHubIssueSummary[]> {
  const { owner, repo } = parseRepository(repository);
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=10`;
  const issues = await fetchJson<GitHubIssueResponse[]>(
    url,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'GitHubのissue一覧取得に失敗しました。トークンやリポジトリアクセス権限を確認してください。'
  );

  return issues
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      state: issue.state,
      author: issue.user?.login ?? 'unknown',
    }));
}

export async function createRepositoryIssue(
  repository: string,
  title: string,
  body: string
): Promise<GitHubCreatedIssue> {
  const { owner, repo } = parseRepository(repository);
  const payload = await fetchJson<CreateIssueResponse>(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title,
        body,
      }),
    },
    'GitHub issueの作成に失敗しました。トークン、権限、入力内容を確認してください。'
  );

  return {
    number: payload.number,
    title: payload.title,
    url: payload.html_url,
  };
}
