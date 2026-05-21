import { IntegrationError } from './errors';

const MONDAY_API_BASE_URL = 'https://api.monday.com/v2';

type MondayGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{
    message?: string;
  }>;
};

type BoardsData = {
  boards?: Array<{
    id?: string;
    name?: string;
    state?: string;
  }>;
};

type ItemsData = {
  boards?: Array<{
    items_page?: {
      items?: Array<{
        id?: string;
        name?: string;
        state?: string;
      }>;
    };
  }>;
};

type CreateItemData = {
  create_item?: {
    id?: string;
    name?: string;
  };
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Monday.com APIトークンが設定されていません。');
  }

  return trimmed;
}

function normalizeRequired(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Monday.comの${label}を指定してください。`);
  }

  return trimmed;
}

function escapeGraphQLString(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

async function mondayRequest<T>(token: string, query: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(MONDAY_API_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: normalizeToken(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as MondayGraphQLResponse<T> | null;

  if (!response.ok) {
    const apiMessage = payload?.errors?.find((entry) => typeof entry.message === 'string')?.message;
    throw new IntegrationError(
      apiMessage && apiMessage.trim() ? `${fallbackMessage} (${apiMessage})` : fallbackMessage
    );
  }

  if (payload?.errors?.length) {
    const apiMessage = payload.errors.find((entry) => typeof entry.message === 'string')?.message;
    throw new IntegrationError(
      apiMessage && apiMessage.trim() ? `${fallbackMessage} (${apiMessage})` : fallbackMessage
    );
  }

  return (payload?.data ?? {}) as T;
}

export async function getBoards(
  token: string
): Promise<Array<{ id: string; name: string; state: string }>> {
  const data = await mondayRequest<BoardsData>(
    token,
    '{ boards(limit: 20) { id name state } }',
    'Monday.comのボード一覧取得に失敗しました。'
  );

  return (data.boards ?? []).map((board) => ({
    id: typeof board.id === 'string' ? board.id : '',
    name: typeof board.name === 'string' && board.name.trim() ? board.name : '(No name)',
    state: typeof board.state === 'string' && board.state.trim() ? board.state : '-',
  }));
}

export async function getItems(
  token: string,
  boardId: string
): Promise<Array<{ id: string; name: string; state: string }>> {
  const normalizedBoardId = normalizeRequired(boardId, 'board_id');
  const data = await mondayRequest<ItemsData>(
    token,
    `{ boards(ids: [${normalizedBoardId}]) { items_page { items { id name state } } } }`,
    'Monday.comのアイテム一覧取得に失敗しました。'
  );

  return (data.boards?.[0]?.items_page?.items ?? []).map((item) => ({
    id: typeof item.id === 'string' ? item.id : '',
    name: typeof item.name === 'string' && item.name.trim() ? item.name : '(No name)',
    state: typeof item.state === 'string' && item.state.trim() ? item.state : '-',
  }));
}

export async function createItem(
  token: string,
  boardId: string,
  itemName: string
): Promise<{ id: string; name: string }> {
  const normalizedBoardId = normalizeRequired(boardId, 'board_id');
  const normalizedItemName = normalizeRequired(itemName, 'item_name');
  const data = await mondayRequest<CreateItemData>(
    token,
    `mutation { create_item(board_id: ${normalizedBoardId}, item_name: "${escapeGraphQLString(normalizedItemName)}") { id name } }`,
    'Monday.comのアイテム作成に失敗しました。'
  );

  return {
    id: typeof data.create_item?.id === 'string' ? data.create_item.id : '',
    name:
      typeof data.create_item?.name === 'string' && data.create_item.name.trim()
        ? data.create_item.name
        : normalizedItemName,
  };
}
