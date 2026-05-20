import { Version3Client } from 'jira.js';
import { IntegrationError } from './errors';

type JiraIssueFields = {
  summary?: string;
  status?: { name?: string | null } | null;
  assignee?: { displayName?: string | null } | null;
  priority?: { name?: string | null } | null;
};

type JiraIssue = {
  id: string;
  key: string;
  self?: string;
  fields?: JiraIssueFields;
};

type JiraSearchResponse = {
  issues?: JiraIssue[];
};

type JiraProject = {
  id: string;
  key: string;
  name: string;
};

type JiraProjectSearchResponse = {
  isLast?: boolean;
  maxResults?: number;
  startAt?: number;
  values: JiraProject[];
};

type JiraCreatedIssue = {
  id: string;
  key: string;
};

const jiraHosts = new WeakMap<Version3Client, string>();

function normalizeHost(host: string): string {
  const trimmed = host.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  if (!trimmed) {
    throw new IntegrationError('Jiraのhostが設定されていません。');
  }

  return trimmed;
}

function getStoredHost(client: Version3Client): string {
  const host = jiraHosts.get(client);

  if (!host) {
    throw new IntegrationError('Jira clientのhost情報が見つかりません。');
  }

  return host;
}

function mapIssue(issue: JiraIssue, host: string) {
  return {
    id: issue.id,
    key: issue.key,
    summary: issue.fields?.summary ?? '(No summary)',
    status: issue.fields?.status?.name ?? 'Unknown',
    assignee: issue.fields?.assignee?.displayName ?? null,
    priority: issue.fields?.priority?.name ?? null,
    url: `https://${host}/browse/${issue.key}`,
  };
}

export function getJiraClient(host: string, email: string, token: string): Version3Client {
  const normalizedHost = normalizeHost(host);
  const trimmedEmail = email.trim();
  const trimmedToken = token.trim();

  if (!trimmedEmail || !trimmedToken) {
    throw new IntegrationError('Jiraの認証情報が不足しています。');
  }

  const client = new Version3Client({
    host: `https://${normalizedHost}`,
    authentication: {
      basic: {
        email: trimmedEmail,
        apiToken: trimmedToken,
      },
    },
  });

  jiraHosts.set(client, normalizedHost);
  return client;
}

export async function listIssues(
  client: Version3Client,
  projectKey?: string
): Promise<
  {
    id: string;
    key: string;
    summary: string;
    status: string;
    assignee: string | null;
    priority: string | null;
    url: string;
  }[]
> {
  const host = getStoredHost(client);
  const trimmedProjectKey = projectKey?.trim();
  const escapedProjectKey = trimmedProjectKey?.replace(/"/g, '\\"');
  const jql = trimmedProjectKey
    ? `project = "${escapedProjectKey}" ORDER BY updated DESC`
    : 'ORDER BY updated DESC';

  const response = await client.issueSearch.searchForIssuesUsingJql<JiraSearchResponse>({
    jql,
    maxResults: 20,
    fields: ['summary', 'status', 'assignee', 'priority'],
  });

  return (response.issues ?? []).map((issue) => mapIssue(issue, host));
}

export async function createIssue(
  client: Version3Client,
  host: string,
  params: {
    projectKey: string;
    summary: string;
    description?: string;
    issueType?: string;
  }
): Promise<{ id: string; key: string; url: string }> {
  const normalizedHost = normalizeHost(host);
  const issue = await client.issues.createIssue<JiraCreatedIssue>({
    fields: {
      project: {
        key: params.projectKey.trim(),
      },
      summary: params.summary.trim(),
      description: params.description?.trim(),
      issuetype: {
        name: params.issueType?.trim() || 'Task',
      },
    },
  });

  return {
    id: issue.id,
    key: issue.key,
    url: `https://${normalizedHost}/browse/${issue.key}`,
  };
}

export async function listProjects(
  client: Version3Client
): Promise<{ id: string; key: string; name: string }[]> {
  const projects: JiraProject[] = [];
  let startAt = 0;

  while (true) {
    const response = await client.projects.searchProjects<JiraProjectSearchResponse>({
      startAt,
      maxResults: 50,
      orderBy: 'key',
    });

    projects.push(...response.values);

    if (response.isLast || response.values.length === 0) {
      break;
    }

    startAt += response.maxResults ?? response.values.length;
  }

  return projects.map((project) => ({
    id: project.id,
    key: project.key,
    name: project.name,
  }));
}

export async function searchIssues(
  client: Version3Client,
  host: string,
  jql: string
): Promise<{ id: string; key: string; summary: string; status: string; url: string }[]> {
  const normalizedHost = normalizeHost(host);
  const response = await client.issueSearch.searchForIssuesUsingJql<JiraSearchResponse>({
    jql: jql.trim(),
    maxResults: 20,
    fields: ['summary', 'status'],
  });

  return (response.issues ?? []).map((issue) => ({
    id: issue.id,
    key: issue.key,
    summary: issue.fields?.summary ?? '(No summary)',
    status: issue.fields?.status?.name ?? 'Unknown',
    url: `https://${normalizedHost}/browse/${issue.key}`,
  }));
}
