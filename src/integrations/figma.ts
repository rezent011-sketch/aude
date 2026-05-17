import { requireEnvVar } from './errors';
import { fetchJson } from './http';

const FIGMA_API_BASE_URL = 'https://api.figma.com/v1';

type FigmaNode = {
  id?: string;
  name?: string;
  type?: string;
  children?: FigmaNode[];
};

type FigmaFileResponse = {
  name: string;
  role?: string;
  lastModified?: string;
  thumbnailUrl?: string;
  version?: string;
  document?: FigmaNode;
};

type FigmaCommentResponse = {
  comments: Array<{
    id: string;
    message: string;
    created_at?: string;
    resolved_at?: string | null;
    user?: {
      handle?: string;
      img_url?: string;
    };
  }>;
};

type FigmaImageExportResponse = {
  images: Record<string, string | null>;
};

export type FigmaFileSummary = {
  key: string;
  name: string;
  role: string | null;
  lastModified: string | null;
  thumbnailUrl: string | null;
  version: string | null;
  pageNames: string[];
};

export type FigmaCommentSummary = {
  id: string;
  message: string;
  createdAt: string | null;
  resolvedAt: string | null;
  author: string | null;
};

export type FigmaExportResult = {
  fileKey: string;
  format: 'png' | 'jpg' | 'svg' | 'pdf';
  images: Array<{
    nodeId: string;
    url: string | null;
  }>;
};

function getHeaders(): Record<string, string> {
  return {
    'X-Figma-Token': requireEnvVar('FIGMA_ACCESS_TOKEN', 'Figma'),
  };
}

function collectPageNames(document?: FigmaNode): string[] {
  if (!document?.children?.length) {
    return [];
  }

  return document.children
    .filter((node) => node.type === 'CANVAS')
    .map((node) => node.name?.trim())
    .filter((name): name is string => Boolean(name));
}

export async function getFigmaFile(fileKey: string): Promise<FigmaFileSummary> {
  const response = await fetchJson<FigmaFileResponse>(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'Figma file の取得に失敗しました。file key、トークン、権限を確認してください。'
  );

  return {
    key: fileKey,
    name: response.name,
    role: response.role ?? null,
    lastModified: response.lastModified ?? null,
    thumbnailUrl: response.thumbnailUrl ?? null,
    version: response.version ?? null,
    pageNames: collectPageNames(response.document),
  };
}

export async function listFigmaComments(fileKey: string): Promise<FigmaCommentSummary[]> {
  const response = await fetchJson<FigmaCommentResponse>(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}/comments?as_md=true`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'Figma comments の取得に失敗しました。file key、スコープ、権限を確認してください。'
  );

  return response.comments.map((comment) => ({
    id: comment.id,
    message: comment.message,
    createdAt: comment.created_at ?? null,
    resolvedAt: comment.resolved_at ?? null,
    author: comment.user?.handle ?? null,
  }));
}

export async function exportFigmaNodes(
  fileKey: string,
  nodeIds: string[],
  format: 'png' | 'jpg' | 'svg' | 'pdf',
  scale?: number
): Promise<FigmaExportResult> {
  const params = new URLSearchParams({
    ids: nodeIds.join(','),
    format,
  });

  if (scale !== undefined) {
    params.set('scale', String(scale));
  }

  const response = await fetchJson<FigmaImageExportResponse>(
    `${FIGMA_API_BASE_URL}/images/${encodeURIComponent(fileKey)}?${params.toString()}`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'Figma export の取得に失敗しました。node id、format、トークン、権限を確認してください。'
  );

  return {
    fileKey,
    format,
    images: nodeIds.map((nodeId) => ({
      nodeId,
      url: response.images[nodeId] ?? null,
    })),
  };
}
