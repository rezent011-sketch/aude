import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

type VercelDeploymentResponse = {
  uid: string;
  name?: string;
  url?: string;
  state?: string;
  createdAt?: number;
  inspectorUrl?: string;
  meta?: {
    githubCommitRef?: string;
  };
};

type VercelDeploymentsListResponse = {
  deployments?: VercelDeploymentResponse[];
};

type VercelProjectResponse = {
  id: string;
  name: string;
  framework?: string | null;
  updatedAt?: number;
};

type VercelProjectsListResponse = {
  projects?: VercelProjectResponse[];
};

export type VercelDeployment = {
  id: string;
  name: string;
  url: string | null;
  state: string;
  branch: string;
  createdAt: string | null;
  inspectorUrl: string | null;
};

export type VercelProject = {
  id: string;
  name: string;
  framework: string;
  updatedAt: string | null;
};

function getHeaders(): Record<string, string> {
  const token = requireEnvVar('VERCEL_TOKEN', 'Vercel');

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function mapDeployment(response: VercelDeploymentResponse): VercelDeployment {
  return {
    id: response.uid,
    name: response.name ?? '(無題)',
    url: response.url ? `https://${response.url}` : null,
    state: response.state ?? 'UNKNOWN',
    branch: response.meta?.githubCommitRef ?? '',
    createdAt: response.createdAt ? new Date(response.createdAt).toISOString() : null,
    inspectorUrl: response.inspectorUrl ?? null,
  };
}

function mapProject(response: VercelProjectResponse): VercelProject {
  return {
    id: response.id,
    name: response.name,
    framework: response.framework ?? 'unknown',
    updatedAt: response.updatedAt ? new Date(response.updatedAt).toISOString() : null,
  };
}

export async function listVercelDeployments(project?: string, limit = 5): Promise<VercelDeployment[]> {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 5;
  const params = new URLSearchParams({
    limit: String(normalizedLimit),
  });

  if (project?.trim()) {
    params.set('projectId', project.trim());
  }

  const response = await fetchJson<VercelDeploymentsListResponse>(
    `https://api.vercel.com/v6/deployments?${params.toString()}`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'Vercel deployment一覧の取得に失敗しました。トークンとプロジェクト設定を確認してください。'
  );

  return (response.deployments ?? []).map(mapDeployment);
}

export async function getVercelDeploymentStatus(deploymentId: string): Promise<VercelDeployment> {
  const trimmedDeploymentId = deploymentId.trim();

  if (!trimmedDeploymentId) {
    throw new IntegrationError('deployment id を入力してください。');
  }

  const response = await fetchJson<VercelDeploymentResponse>(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(trimmedDeploymentId)}`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'Vercel deploymentステータスの取得に失敗しました。deployment id と権限を確認してください。'
  );

  return mapDeployment(response);
}

export async function listVercelProjects(limit = 10): Promise<VercelProject[]> {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 10;

  const response = await fetchJson<VercelProjectsListResponse>(
    `https://api.vercel.com/v9/projects?limit=${normalizedLimit}`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'Vercel project一覧の取得に失敗しました。トークンと権限を確認してください。'
  );

  return (response.projects ?? []).map(mapProject);
}
