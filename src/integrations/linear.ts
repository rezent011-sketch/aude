import { LinearClient } from '@linear/sdk';
import { IntegrationError } from './errors';

export type LinearIssueSummary = {
  id: string;
  title: string;
  state: string;
  priority: number;
  assignee: string | null;
  url: string;
};

export type LinearCreatedIssue = {
  id: string;
  title: string;
  url: string;
};

export type LinearTeamSummary = {
  id: string;
  name: string;
  key: string;
};

export type LinearIssueSearchResult = {
  id: string;
  title: string;
  state: string;
  url: string;
};

export function getLinearClient(apiKey: string): LinearClient {
  const trimmedApiKey = apiKey.trim();

  if (!trimmedApiKey) {
    throw new IntegrationError('Linear APIキーが設定されていません。');
  }

  return new LinearClient({ apiKey: trimmedApiKey });
}

async function resolveIssueStateName(
  issue: Awaited<ReturnType<LinearClient['issues']>>['nodes'][number]
): Promise<string> {
  const state = await issue.state;
  return state?.name ?? 'Unknown';
}

async function resolveIssueAssigneeName(
  issue: Awaited<ReturnType<LinearClient['issues']>>['nodes'][number]
): Promise<string | null> {
  const assignee = await issue.assignee;
  return assignee?.name ?? null;
}

export async function listIssues(
  apiKey: string,
  teamId?: string
): Promise<LinearIssueSummary[]> {
  const client = getLinearClient(apiKey);
  const issues = await client.issues({
    first: 20,
    ...(teamId ? { filter: { team: { id: { eq: teamId } } } } : {}),
  });

  return Promise.all(
    issues.nodes.map(async (issue) => ({
      id: issue.identifier || issue.id,
      title: issue.title,
      state: await resolveIssueStateName(issue),
      priority: issue.priority,
      assignee: await resolveIssueAssigneeName(issue),
      url: issue.url,
    }))
  );
}

export async function createIssue(
  apiKey: string,
  params: {
    title: string;
    description?: string;
    teamId: string;
    priority?: number;
  }
): Promise<LinearCreatedIssue> {
  const client = getLinearClient(apiKey);
  const payload = await client.createIssue({
    title: params.title,
    description: params.description,
    teamId: params.teamId,
    ...(typeof params.priority === 'number' ? { priority: params.priority } : {}),
  });

  const issue = await payload.issue;
  if (!payload.success || !issue) {
    throw new IntegrationError('Linear issueの作成に失敗しました。入力内容と権限を確認してください。');
  }

  return {
    id: issue.identifier || issue.id,
    title: issue.title,
    url: issue.url,
  };
}

export async function getTeams(apiKey: string): Promise<LinearTeamSummary[]> {
  const client = getLinearClient(apiKey);
  const teams = await client.teams({ first: 50 });

  return teams.nodes.map((team) => ({
    id: team.id,
    name: team.name,
    key: team.key,
  }));
}

export async function searchIssues(
  apiKey: string,
  query: string
): Promise<LinearIssueSearchResult[]> {
  const client = getLinearClient(apiKey);
  const result = await client.searchIssues(query, { first: 20 });

  return Promise.all(
    result.nodes.map(async (issue) => ({
      id: issue.identifier || issue.id,
      title: issue.title,
      state: (await issue.state)?.name ?? 'Unknown',
      url: issue.url,
    }))
  );
}
