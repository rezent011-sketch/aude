import { IntegrationError } from './errors';

const WEBFLOW_API_BASE_URL = 'https://api.webflow.com/v2';

type WebflowErrorResponse = {
  msg?: string;
  message?: string;
};

type WebflowSitesResponse = {
  sites?: Array<{
    id?: string;
    displayName?: string;
    shortName?: string;
    lastPublished?: string;
  }>;
};

type WebflowCollectionsResponse = {
  collections?: Array<{
    id?: string;
    displayName?: string;
    slug?: string;
  }>;
};

type WebflowPublishResponse = {
  queued?: boolean;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Webflowのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function normalizeValue(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Webflowの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const objectPayload = payload as WebflowErrorResponse;
  if (typeof objectPayload.message === 'string' && objectPayload.message.trim()) {
    return objectPayload.message;
  }

  return typeof objectPayload.msg === 'string' && objectPayload.msg.trim()
    ? objectPayload.msg
    : null;
}

async function webflowRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${WEBFLOW_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractErrorMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getSites(
  token: string
): Promise<Array<{ id: string; displayName: string; shortName: string; lastPublished: string }>> {
  const response = await webflowRequest<WebflowSitesResponse>(
    '/sites',
    token,
    { method: 'GET' },
    'Webflowのサイト一覧取得に失敗しました。'
  );

  return (response.sites ?? []).map((site) => ({
    id: typeof site.id === 'string' ? site.id : '',
    displayName:
      typeof site.displayName === 'string' && site.displayName.trim()
        ? site.displayName
        : '(No name)',
    shortName: typeof site.shortName === 'string' ? site.shortName : '',
    lastPublished: typeof site.lastPublished === 'string' ? site.lastPublished : '',
  }));
}

export async function getCollections(
  token: string,
  siteId: string
): Promise<Array<{ id: string; displayName: string; slug: string }>> {
  const normalizedSiteId = normalizeValue(siteId, 'site_id');
  const response = await webflowRequest<WebflowCollectionsResponse>(
    `/sites/${encodeURIComponent(normalizedSiteId)}/collections`,
    token,
    { method: 'GET' },
    'Webflowのコレクション一覧取得に失敗しました。'
  );

  return (response.collections ?? []).map((collection) => ({
    id: typeof collection.id === 'string' ? collection.id : '',
    displayName:
      typeof collection.displayName === 'string' && collection.displayName.trim()
        ? collection.displayName
        : '(No name)',
    slug: typeof collection.slug === 'string' ? collection.slug : '',
  }));
}

export async function publishSite(
  token: string,
  siteId: string
): Promise<{ queued: boolean }> {
  const normalizedSiteId = normalizeValue(siteId, 'site_id');
  const response = await webflowRequest<WebflowPublishResponse>(
    `/sites/${encodeURIComponent(normalizedSiteId)}/publish`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        publishToWebflowSubdomain: true,
      }),
    },
    'Webflowのサイト公開に失敗しました。'
  );

  return {
    queued: response.queued === true,
  };
}
