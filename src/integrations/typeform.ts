import { IntegrationError } from './errors';

const TYPEFORM_API_BASE_URL = 'https://api.typeform.com';

type TypeformFormsResponse = {
  items?: Array<{
    id?: string;
    title?: string;
    last_updated_at?: string;
  }>;
};

type TypeformResponsesResponse = {
  items?: Array<{
    submitted_at?: string;
    answers?: Array<{
      field?: {
        ref?: string;
      };
      type?: string;
      text?: string;
      choice?: {
        label?: string;
      };
    }>;
  }>;
};

type TypeformFormResponse = {
  id?: string;
  title?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Typeformのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const description = (payload as { description?: unknown }).description;
  if (typeof description === 'string' && description.trim()) {
    return description;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function typeformRequest<T>(path: string, token: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${TYPEFORM_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json',
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

export async function getForms(
  token: string
): Promise<Array<{ id: string; title: string; last_updated_at: string; response_count: number }>> {
  const response = await typeformRequest<TypeformFormsResponse>(
    '/forms?page_size=20',
    token,
    'Typeformのフォーム一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((form) => ({
    id: typeof form.id === 'string' ? form.id : '',
    title: typeof form.title === 'string' && form.title.trim() ? form.title : '(No title)',
    last_updated_at: typeof form.last_updated_at === 'string' ? form.last_updated_at : '',
    response_count: 0,
  }));
}

export async function getResponses(
  token: string,
  formId: string,
  pageSize = 10
): Promise<
  Array<{
    submitted_at: string;
    answers: Array<{
      field: { ref: string };
      type: string;
      text?: string;
      choice?: { label: string };
    }>;
  }>
> {
  const normalizedFormId = formId.trim();

  if (!normalizedFormId) {
    throw new IntegrationError('Typeformのform IDを指定してください。');
  }

  const normalizedPageSize = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 10;
  const response = await typeformRequest<TypeformResponsesResponse>(
    `/forms/${encodeURIComponent(normalizedFormId)}/responses?page_size=${normalizedPageSize}`,
    token,
    'Typeformの回答一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((item) => ({
    submitted_at: typeof item.submitted_at === 'string' ? item.submitted_at : '',
    answers: (item.answers ?? []).map((answer) => {
      const normalizedAnswer: {
        field: { ref: string };
        type: string;
        text?: string;
        choice?: { label: string };
      } = {
        field: {
          ref: typeof answer.field?.ref === 'string' ? answer.field.ref : '',
        },
        type: typeof answer.type === 'string' ? answer.type : '',
      };

      if (typeof answer.text === 'string') {
        normalizedAnswer.text = answer.text;
      }

      if (typeof answer.choice?.label === 'string') {
        normalizedAnswer.choice = { label: answer.choice.label };
      }

      return normalizedAnswer;
    }),
  }));
}

export async function getFormSummary(
  token: string,
  formId: string
): Promise<{ id: string; title: string; response_count: number }> {
  const normalizedFormId = formId.trim();

  if (!normalizedFormId) {
    throw new IntegrationError('Typeformのform IDを指定してください。');
  }

  const response = await typeformRequest<TypeformFormResponse>(
    `/forms/${encodeURIComponent(normalizedFormId)}`,
    token,
    'Typeformのフォーム詳細取得に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : normalizedFormId,
    title: typeof response.title === 'string' && response.title.trim() ? response.title : '(No title)',
    response_count: 0,
  };
}
