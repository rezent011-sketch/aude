import { IntegrationError, requireEnvVar } from './errors';
import { fetchJson } from './http';

const CANVA_API_BASE_URL = 'https://api.canva.com/rest/v1';

type CanvaDesignApi = {
  id: string;
  title?: string | null;
  created_at: number;
  updated_at: number;
  page_count?: number | null;
  thumbnail?: {
    url?: string | null;
  } | null;
  urls?: {
    edit_url?: string | null;
    view_url?: string | null;
  } | null;
};

type CanvaListDesignsResponse = {
  items: CanvaDesignApi[];
  continuation?: string | null;
};

type CanvaCreateDesignResponse = {
  design: CanvaDesignApi;
};

type CanvaPresetDesignName = 'doc' | 'presentation' | 'whiteboard' | 'email';

export type CanvaDesignSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pageCount: number | null;
  thumbnailUrl: string | null;
  editUrl: string | null;
  viewUrl: string | null;
};

export type CreateCanvaDesignInput =
  | {
      title: string;
      preset: CanvaPresetDesignName;
      assetId?: string;
    }
  | {
      title: string;
      width: number;
      height: number;
      assetId?: string;
    };

function getHeaders(includeJson = false): Record<string, string> {
  return {
    Authorization: `Bearer ${requireEnvVar('CANVA_ACCESS_TOKEN', 'Canva')}`,
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
  };
}

function toIsoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

function mapDesign(design: CanvaDesignApi): CanvaDesignSummary {
  return {
    id: design.id,
    title: design.title?.trim() || '(無題)',
    createdAt: toIsoDate(design.created_at),
    updatedAt: toIsoDate(design.updated_at),
    pageCount: design.page_count ?? null,
    thumbnailUrl: design.thumbnail?.url ?? null,
    editUrl: design.urls?.edit_url ?? null,
    viewUrl: design.urls?.view_url ?? null,
  };
}

export async function listCanvaDesigns(
  query?: string,
  limit = 10
): Promise<{ items: CanvaDesignSummary[]; continuation: string | null }> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', String(limit));

  if (query?.trim()) {
    searchParams.set('query', query.trim());
  }

  const response = await fetchJson<CanvaListDesignsResponse>(
    `${CANVA_API_BASE_URL}/designs?${searchParams.toString()}`,
    {
      method: 'GET',
      headers: getHeaders(),
    },
    'Canva design一覧の取得に失敗しました。アクセストークンやスコープを確認してください。'
  );

  return {
    items: response.items.map(mapDesign),
    continuation: response.continuation ?? null,
  };
}

export async function createCanvaDesign(
  input: CreateCanvaDesignInput
): Promise<CanvaDesignSummary> {
  const body =
    'preset' in input
      ? {
          type: 'type_and_asset',
          title: input.title,
          asset_id: input.assetId,
          design_type: {
            type: 'preset',
            name: input.preset,
          },
        }
      : {
          type: 'type_and_asset',
          title: input.title,
          asset_id: input.assetId,
          design_type: {
            type: 'custom',
            width: input.width,
            height: input.height,
          },
        };

  const response = await fetchJson<CanvaCreateDesignResponse>(
    `${CANVA_API_BASE_URL}/designs`,
    {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(body),
    },
    'Canva design の作成に失敗しました。入力内容、アクセストークン、権限を確認してください。'
  );

  if (!response.design) {
    throw new IntegrationError('Canva design の作成結果を取得できませんでした。');
  }

  return mapDesign(response.design);
}
