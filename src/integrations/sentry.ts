import { IntegrationError } from './errors';

const SENTRY_API_BASE_URL = 'https://sentry.io/api/0';

type SentryOrganization = {
  id?: string;
  slug?: string;
  name?: string;
};

type SentryProject = {
  id?: string;
  slug?: string;
  name?: string;
  platform?: string | null;
};

type SentryIssue = {
  id?: string;
  title?: string;
  status?: string;
  level?: string;
  lastSeen?: string;
  count?: string | number;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('SentryのAuth Tokenが設定されていません。');
  }

  return trimmed;
}

function extractApiError(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return null;
}

async function sentryRequest<T>(path: string, token: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${SENTRY_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        Accept: 'application/json',
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractApiError(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getOrganizations(
  token: string
): Promise<Array<{ id: string; slug: string; name: string }>> {
  const response = await sentryRequest<SentryOrganization[]>(
    '/organizations/',
    token,
    'Sentryのorganization一覧取得に失敗しました。'
  );

  return response.map((organization) => ({
    id: typeof organization.id === 'string' ? organization.id : '',
    slug:
      typeof organization.slug === 'string' && organization.slug.trim()
        ? organization.slug
        : '(No slug)',
    name:
      typeof organization.name === 'string' && organization.name.trim()
        ? organization.name
        : '(No name)',
  }));
}

export async function getProjects(
  token: string,
  orgSlug: string
): Promise<Array<{ id: string; slug: string; name: string; platform: string }>> {
  const normalizedOrgSlug = orgSlug.trim();

  if (!normalizedOrgSlug) {
    throw new IntegrationError('Sentryのorg_slugを指定してください。');
  }

  const response = await sentryRequest<SentryProject[]>(
    `/organizations/${encodeURIComponent(normalizedOrgSlug)}/projects/`,
    token,
    'Sentryのproject一覧取得に失敗しました。'
  );

  return response.map((project) => ({
    id: typeof project.id === 'string' ? project.id : '',
    slug: typeof project.slug === 'string' && project.slug.trim() ? project.slug : '(No slug)',
    name: typeof project.name === 'string' && project.name.trim() ? project.name : '(No name)',
    platform: typeof project.platform === 'string' && project.platform.trim() ? project.platform : '-',
  }));
}

export async function getIssues(
  token: string,
  orgSlug: string,
  projectSlug: string
): Promise<
  Array<{
    id: string;
    title: string;
    status: string;
    level: string;
    lastSeen: string;
    count: string;
  }>
> {
  const normalizedOrgSlug = orgSlug.trim();
  const normalizedProjectSlug = projectSlug.trim();

  if (!normalizedOrgSlug || !normalizedProjectSlug) {
    throw new IntegrationError('Sentryのorg_slugとproject_slugを指定してください。');
  }

  const response = await sentryRequest<SentryIssue[]>(
    `/projects/${encodeURIComponent(normalizedOrgSlug)}/${encodeURIComponent(normalizedProjectSlug)}/issues/?limit=20`,
    token,
    'Sentryのissue一覧取得に失敗しました。'
  );

  return response.map((issue) => ({
    id: typeof issue.id === 'string' ? issue.id : '',
    title: typeof issue.title === 'string' && issue.title.trim() ? issue.title : '(No title)',
    status: typeof issue.status === 'string' && issue.status.trim() ? issue.status : 'unknown',
    level: typeof issue.level === 'string' && issue.level.trim() ? issue.level : 'unknown',
    lastSeen: typeof issue.lastSeen === 'string' ? issue.lastSeen : '',
    count: typeof issue.count === 'number' ? String(issue.count) : typeof issue.count === 'string' ? issue.count : '0',
  }));
}
