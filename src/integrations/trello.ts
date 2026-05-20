import { IntegrationError } from './errors';

const TRELLO_API_BASE_URL = 'https://api.trello.com/1';

type TrelloBoardResponse = {
  id: string;
  name: string;
  url: string;
  closed: boolean;
};

type TrelloListResponse = {
  id: string;
  name: string;
  closed: boolean;
};

type TrelloCardResponse = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  url: string;
  idList: string;
};

type TrelloCreateCardResponse = {
  id: string;
  name: string;
  url: string;
};

type TrelloMoveCardResponse = {
  id: string;
  name: string;
};

type TrelloErrorPayload = {
  message?: string;
};

function normalizeCredential(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Trelloの${label}が設定されていません。`);
  }

  return trimmed;
}

function buildUrl(path: string, apiKey: string, token: string): URL {
  const url = new URL(`${TRELLO_API_BASE_URL}${path}`);
  url.searchParams.set('key', normalizeCredential(apiKey, 'API key'));
  url.searchParams.set('token', normalizeCredential(token, 'token'));
  return url;
}

async function trelloRequest<T>(
  path: string,
  apiKey: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildUrl(path, apiKey, token), init);
  } catch (error) {
    throw new IntegrationError('Trello APIへの接続に失敗しました。', { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as TrelloErrorPayload | T | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : null;

    throw new IntegrationError(
      message
        ? `Trello APIリクエストに失敗しました。(${message})`
        : 'Trello APIリクエストに失敗しました。'
    );
  }

  return payload as T;
}

export async function getBoards(
  apiKey: string,
  token: string
): Promise<{ id: string; name: string; url: string; closed: boolean }[]> {
  const boards = await trelloRequest<TrelloBoardResponse[]>(
    '/members/me/boards',
    apiKey,
    token
  );

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    url: board.url,
    closed: board.closed,
  }));
}

export async function getLists(
  apiKey: string,
  token: string,
  boardId: string
): Promise<{ id: string; name: string; closed: boolean }[]> {
  const trimmedBoardId = boardId.trim();

  if (!trimmedBoardId) {
    throw new IntegrationError('Trelloのboard IDを指定してください。');
  }

  const lists = await trelloRequest<TrelloListResponse[]>(
    `/boards/${encodeURIComponent(trimmedBoardId)}/lists`,
    apiKey,
    token
  );

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    closed: list.closed,
  }));
}

export async function getCards(
  apiKey: string,
  token: string,
  boardId: string
): Promise<{ id: string; name: string; desc: string; due: string | null; url: string; idList: string }[]> {
  const trimmedBoardId = boardId.trim();

  if (!trimmedBoardId) {
    throw new IntegrationError('Trelloのboard IDを指定してください。');
  }

  const cards = await trelloRequest<TrelloCardResponse[]>(
    `/boards/${encodeURIComponent(trimmedBoardId)}/cards`,
    apiKey,
    token
  );

  return cards.map((card) => ({
    id: card.id,
    name: card.name,
    desc: card.desc,
    due: card.due,
    url: card.url,
    idList: card.idList,
  }));
}

export async function createCard(
  apiKey: string,
  token: string,
  params: {
    idList: string;
    name: string;
    desc?: string;
    due?: string;
  }
): Promise<{ id: string; name: string; url: string }> {
  const idList = params.idList.trim();
  const name = params.name.trim();

  if (!idList) {
    throw new IntegrationError('Trelloのlist IDを指定してください。');
  }

  if (!name) {
    throw new IntegrationError('Trello card名を指定してください。');
  }

  const body = new URLSearchParams({
    idList,
    name,
  });

  if (params.desc?.trim()) {
    body.set('desc', params.desc.trim());
  }

  if (params.due?.trim()) {
    body.set('due', params.due.trim());
  }

  const card = await trelloRequest<TrelloCreateCardResponse>('/cards', apiKey, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body,
  });

  return {
    id: card.id,
    name: card.name,
    url: card.url,
  };
}

export async function moveCard(
  apiKey: string,
  token: string,
  cardId: string,
  idList: string
): Promise<{ id: string; name: string }> {
  const trimmedCardId = cardId.trim();
  const trimmedListId = idList.trim();

  if (!trimmedCardId) {
    throw new IntegrationError('Trelloのcard IDを指定してください。');
  }

  if (!trimmedListId) {
    throw new IntegrationError('Trelloのlist IDを指定してください。');
  }

  const card = await trelloRequest<TrelloMoveCardResponse>(
    `/cards/${encodeURIComponent(trimmedCardId)}`,
    apiKey,
    token,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams({
        idList: trimmedListId,
      }),
    }
  );

  return {
    id: card.id,
    name: card.name,
  };
}
