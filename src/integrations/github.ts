import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

type GitHubIssueResponse = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  user?: { login?: string };
  pull_request?: unknown;
};

type CreateIssueResponse = {
  number: number;
  title: string;
  html_url: string;
};

type GitHubPullRequestResponse = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  head?: { ref?: string };
  base?: { ref?: string };
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

export type GitHubListIssuesOptions = {
  state?: 'open' | 'closed' | 'all';
  perPage?: number;
};

export type GitHubCreatePullRequestInput = {
  title: string;
  head: string;
  base: string;
  body?: string;
};

export type GitHubCreatedPullRequest = {
  number: number;
  title: string;
  url: string;
  state: string;
  head: string;
  base: string;
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

function mapIssue(issue: GitHubIssueResponse): GitHubIssueSummary {
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    author: issue.user?.login ?? 'unknown',
  };
}

export async function listRepositoryIssues(
  repository: string,
  options: GitHubListIssuesOptions = {}
): Promise<GitHubIssueSummary[]> {
  const { owner, repo } = parseRepository(repository);
  const params = new URLSearchParams({
    state: options.state ?? 'open',
    per_page: String(options.perPage ?? 10),
  });
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?${params.toString()}`;
  const issues = await fetchJson<GitHubIssueResponse[]>(
    url,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'GitHubのissue一覧取得に失敗しました。トークンやリポジトリアクセス権限を確認してください。'
  );

  return issues.filter((issue) => !issue.pull_request).map(mapIssue);
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
        title: title.trim(),
        body: body.trim(),
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

export async function createPullRequest(
  repository: string,
  input: GitHubCreatePullRequestInput
): Promise<GitHubCreatedPullRequest> {
  const { owner, repo } = parseRepository(repository);

  if (!input.title.trim()) {
    throw new IntegrationError('PRタイトルを入力してください。');
  }

  if (!input.head.trim() || !input.base.trim()) {
    throw new IntegrationError('PR作成には head と base を指定してください。');
  }

  const payload = await fetchJson<GitHubPullRequestResponse>(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        title: input.title.trim(),
        head: input.head.trim(),
        base: input.base.trim(),
        body: input.body?.trim() || undefined,
      }),
    },
    'GitHub PRの作成に失敗しました。トークン、ブランチ名、権限を確認してください。'
  );

  return {
    number: payload.number,
    title: payload.title,
    url: payload.html_url,
    state: payload.state,
    head: payload.head?.ref ?? input.head.trim(),
    base: payload.base?.ref ?? input.base.trim(),
  };
}
