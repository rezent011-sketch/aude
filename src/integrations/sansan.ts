import { IntegrationError } from './errors';

const SANSAN_API_BASE_URL = 'https://api.sansan.com/v2';

type SansanBizCardListResponse = {
  data?: Array<{
    bizCardId?: string;
    name?: {
      lastName?: string;
      firstName?: string;
    };
    company?: {
      name?: string;
    };
    email?: string;
  }>;
};

type SansanBizCardResponse = {
  data?: {
    bizCardId?: string;
    name?: {
      lastName?: string;
      firstName?: string;
    };
    company?: {
      name?: string;
    };
    title?: string;
    email?: string;
    tel?: string;
  };
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Sansan APIトークンが設定されていません。');
  }

  return trimmed;
}

function buildName(lastName?: string, firstName?: string): string {
  const parts = [lastName, firstName].filter(
    (value): value is string => typeof value === 'string' && Boolean(value.trim())
  );

  return parts.length > 0 ? parts.join(' ') : '(No name)';
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function sansanRequest<T>(path: string, token: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${SANSAN_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Sansan-Token': normalizeToken(token),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const apiMessage = extractMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getContacts(
  token: string,
  keyword?: string
): Promise<Array<{ id: string; name: string; company: string; email: string }>> {
  const searchParams = new URLSearchParams();
  const normalizedKeyword = keyword?.trim();

  if (normalizedKeyword) {
    searchParams.set('keyword', normalizedKeyword);
  }

  const path = `/bizCards${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const response = await sansanRequest<SansanBizCardListResponse>(
    path,
    token,
    'Sansanの名刺一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((contact) => ({
    id: typeof contact.bizCardId === 'string' ? contact.bizCardId : '',
    name: buildName(contact.name?.lastName, contact.name?.firstName),
    company:
      typeof contact.company?.name === 'string' && contact.company.name.trim()
        ? contact.company.name
        : '(No company)',
    email: typeof contact.email === 'string' ? contact.email : '',
  }));
}

export async function getContact(
  token: string,
  id: string
): Promise<{ id: string; name: string; company: string; title: string; email: string; tel: string }> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new IntegrationError('Sansanの名刺IDを指定してください。');
  }

  const response = await sansanRequest<SansanBizCardResponse>(
    `/bizCards/${encodeURIComponent(normalizedId)}`,
    token,
    'Sansanの名刺詳細取得に失敗しました。'
  );

  return {
    id: typeof response.data?.bizCardId === 'string' ? response.data.bizCardId : '',
    name: buildName(response.data?.name?.lastName, response.data?.name?.firstName),
    company:
      typeof response.data?.company?.name === 'string' && response.data.company.name.trim()
        ? response.data.company.name
        : '(No company)',
    title: typeof response.data?.title === 'string' ? response.data.title : '',
    email: typeof response.data?.email === 'string' ? response.data.email : '',
    tel: typeof response.data?.tel === 'string' ? response.data.tel : '',
  };
}
