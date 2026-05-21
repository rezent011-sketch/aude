import { IntegrationError } from './errors';
import { fetchJson } from './http';

const FIGMA_API_BASE_URL = 'https://api.figma.com/v1';

type FigmaProjectsResponse = {
  projects?: Array<{
    id?: string;
    name?: string;
  }>;
};

type FigmaFilesResponse = {
  files?: Array<{
    key?: string;
    name?: string;
    last_modified?: string;
  }>;
};

type FigmaCommentsResponse = {
  comments?: Array<{
    id?: string;
    message?: string;
    user?: {
      handle?: string;
    };
    created_at?: string;
  }>;
};

function getHeaders(token: string): Record<string, string> {
  const normalized = token.trim();

  if (!normalized) {
    throw new IntegrationError('Figmaアクセストークンが設定されていません。');
  }

  return {
    'X-Figma-Token': normalized,
  };
}

export async function getTeamProjects(
  token: string,
  teamId: string
): Promise<Array<{ id: string; name: string }>> {
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) {
    throw new IntegrationError('Figmaのteam_idを指定してください。');
  }

  const response = await fetchJson<FigmaProjectsResponse>(
    `${FIGMA_API_BASE_URL}/teams/${encodeURIComponent(normalizedTeamId)}/projects`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Figmaのプロジェクト一覧取得に失敗しました。'
  );

  return (response.projects ?? []).map((project) => ({
    id: typeof project.id === 'string' ? project.id : '',
    name: typeof project.name === 'string' && project.name.trim() ? project.name : '(No name)',
  }));
}

export async function getProjectFiles(
  token: string,
  projectId: string
): Promise<Array<{ key: string; name: string; last_modified: string }>> {
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    throw new IntegrationError('Figmaのproject_idを指定してください。');
  }

  const response = await fetchJson<FigmaFilesResponse>(
    `${FIGMA_API_BASE_URL}/projects/${encodeURIComponent(normalizedProjectId)}/files`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Figmaのファイル一覧取得に失敗しました。'
  );

  return (response.files ?? []).map((file) => ({
    key: typeof file.key === 'string' ? file.key : '',
    name: typeof file.name === 'string' && file.name.trim() ? file.name : '(No name)',
    last_modified: typeof file.last_modified === 'string' ? file.last_modified : '',
  }));
}

export async function getFileComments(
  token: string,
  fileKey: string
): Promise<Array<{ id: string; message: string; user: string; created_at: string }>> {
  const normalizedFileKey = fileKey.trim();

  if (!normalizedFileKey) {
    throw new IntegrationError('Figmaのfile_keyを指定してください。');
  }

  const response = await fetchJson<FigmaCommentsResponse>(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(normalizedFileKey)}/comments`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Figmaのコメント一覧取得に失敗しました。'
  );

  return (response.comments ?? []).map((comment) => ({
    id: typeof comment.id === 'string' ? comment.id : '',
    message: typeof comment.message === 'string' ? comment.message : '',
    user: typeof comment.user?.handle === 'string' ? comment.user.handle : '',
    created_at: typeof comment.created_at === 'string' ? comment.created_at : '',
  }));
}
