import { IntegrationError } from './errors';

const MIRO_API_BASE_URL = 'https://api.miro.com/v2';

type MiroErrorResponse = {
  message?: string;
  type?: string;
};

type MiroBoardsResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    description?: string;
    viewLink?: string;
  }>;
};

type MiroBoardResponse = {
  id?: string;
  name?: string;
  createdAt?: string;
  modifiedAt?: string;
  collaboratorCount?: number;
};

type MiroStickyNoteResponse = {
  id?: string;
  data?: {
    content?: string;
  };
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Miroのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function normalizeValue(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Miroの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as MiroErrorResponse).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function miroRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${MIRO_API_BASE_URL}${path}`, {
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

export async function getBoards(
  token: string
): Promise<Array<{ id: string; name: string; description: string; viewLink: string }>> {
  const response = await miroRequest<MiroBoardsResponse>(
    '/boards?limit=20',
    token,
    { method: 'GET' },
    'Miroのボード一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((board) => ({
    id: typeof board.id === 'string' ? board.id : '',
    name: typeof board.name === 'string' && board.name.trim() ? board.name : '(No name)',
    description: typeof board.description === 'string' ? board.description : '',
    viewLink: typeof board.viewLink === 'string' ? board.viewLink : '',
  }));
}

export async function getBoard(
  token: string,
  boardId: string
): Promise<{
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  collaborators: number;
}> {
  const normalizedBoardId = normalizeValue(boardId, 'board_id');
  const response = await miroRequest<MiroBoardResponse>(
    `/boards/${encodeURIComponent(normalizedBoardId)}`,
    token,
    { method: 'GET' },
    'Miroのボード情報取得に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    name: typeof response.name === 'string' && response.name.trim() ? response.name : '(No name)',
    createdAt: typeof response.createdAt === 'string' ? response.createdAt : '',
    modifiedAt: typeof response.modifiedAt === 'string' ? response.modifiedAt : '',
    collaborators: typeof response.collaboratorCount === 'number' ? response.collaboratorCount : 0,
  };
}

export async function createStickyNote(
  token: string,
  boardId: string,
  content: string,
  color?: string
): Promise<{ id: string; content: string }> {
  const normalizedBoardId = normalizeValue(boardId, 'board_id');
  const normalizedContent = normalizeValue(content, 'content');
  const normalizedColor = color?.trim() || 'light_yellow';
  const response = await miroRequest<MiroStickyNoteResponse>(
    `/boards/${encodeURIComponent(normalizedBoardId)}/sticky_notes`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          content: normalizedContent,
          shape: 'square',
        },
        style: {
          fillColor: normalizedColor,
        },
      }),
    },
    'Miroの付箋作成に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : '',
    content: typeof response.data?.content === 'string' ? response.data.content : '',
  };
}
