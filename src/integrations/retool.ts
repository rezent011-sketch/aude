import { IntegrationError } from './errors';
import { fetchJson } from './http';

const RETOOL_API_BASE_URL = 'https://api.retool.com/v1';

type RetoolAppItem = {
  id?: string;
  name?: string;
  pageUuid?: string;
  createdAt?: string;
  updatedAt?: string;
};

type RetoolUserItem = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  memberRole?: string;
};

type RetoolAppsResponse = {
  success?: boolean;
  data?: RetoolAppItem[];
};

type RetoolUsersResponse = {
  success?: boolean;
  data?: RetoolUserItem[];
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Retool Access Tokenが設定されていません。');
  }

  return trimmed;
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeToken(token)}`,
    Accept: 'application/json',
  };
}

export async function getApps(
  token: string
): Promise<
  Array<{ id: string; name: string; pageUuid: string; createdAt: string; updatedAt: string }>
> {
  const response = await fetchJson<RetoolAppsResponse>(
    `${RETOOL_API_BASE_URL}/apps`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Retoolのアプリ一覧取得に失敗しました。'
  );

  if (response.success === false) {
    throw new IntegrationError('Retoolのアプリ一覧取得に失敗しました。');
  }

  return (response.data ?? []).map((app) => ({
    id: typeof app.id === 'string' ? app.id : '',
    name: typeof app.name === 'string' && app.name.trim() ? app.name : '(No name)',
    pageUuid: typeof app.pageUuid === 'string' ? app.pageUuid : '',
    createdAt: typeof app.createdAt === 'string' ? app.createdAt : '',
    updatedAt: typeof app.updatedAt === 'string' ? app.updatedAt : '',
  }));
}

export async function getUsers(
  token: string
): Promise<
  Array<{ id: string; email: string; firstName: string; lastName: string; role: string }>
> {
  const response = await fetchJson<RetoolUsersResponse>(
    `${RETOOL_API_BASE_URL}/users`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Retoolのユーザー一覧取得に失敗しました。'
  );

  if (response.success === false) {
    throw new IntegrationError('Retoolのユーザー一覧取得に失敗しました。');
  }

  return (response.data ?? []).map((user) => ({
    id: typeof user.id === 'string' ? user.id : '',
    email: typeof user.email === 'string' ? user.email : '',
    firstName: typeof user.firstName === 'string' ? user.firstName : '',
    lastName: typeof user.lastName === 'string' ? user.lastName : '',
    role: typeof user.memberRole === 'string' ? user.memberRole : '',
  }));
}
