import { IntegrationError } from './errors';

const SURVEYMONKEY_API_BASE_URL = 'https://api.surveymonkey.com/v3';

type SurveyMonkeyErrorResponse = {
  error?: {
    message?: string;
  };
  message?: string;
};

type SurveyMonkeySurveysResponse = {
  data?: Array<{
    id?: string;
    title?: string;
    response_count?: number;
    date_created?: string;
  }>;
};

type SurveyMonkeySurveyDetailsResponse = {
  id?: string;
  title?: string;
  question_count?: number;
  response_count?: number;
};

type SurveyMonkeyResponsesResponse = {
  data?: Array<{
    id?: string;
    date_created?: string;
    total_time?: number;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('SurveyMonkeyのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeRequired(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`SurveyMonkeyの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const errorMessage = (payload as SurveyMonkeyErrorResponse).error?.message;
  if (typeof errorMessage === 'string' && errorMessage.trim()) {
    return errorMessage;
  }

  const message = (payload as SurveyMonkeyErrorResponse).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function surveyMonkeyRequest<T>(
  path: string,
  token: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${SURVEYMONKEY_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getSurveys(
  token: string
): Promise<Array<{ id: string; title: string; response_count: number; date_created: string }>> {
  const response = await surveyMonkeyRequest<SurveyMonkeySurveysResponse>(
    '/surveys?per_page=20',
    token,
    'SurveyMonkeyのアンケート一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((survey) => ({
    id: typeof survey.id === 'string' ? survey.id : '',
    title: typeof survey.title === 'string' && survey.title.trim() ? survey.title : '(No title)',
    response_count: typeof survey.response_count === 'number' ? survey.response_count : 0,
    date_created: typeof survey.date_created === 'string' ? survey.date_created : '',
  }));
}

export async function getSurveyDetails(
  token: string,
  surveyId: string
): Promise<{ id: string; title: string; question_count: number; response_count: number }> {
  const normalizedSurveyId = normalizeRequired(surveyId, 'survey_id');
  const response = await surveyMonkeyRequest<SurveyMonkeySurveyDetailsResponse>(
    `/surveys/${encodeURIComponent(normalizedSurveyId)}/details`,
    token,
    'SurveyMonkeyのアンケート詳細取得に失敗しました。'
  );

  return {
    id: typeof response.id === 'string' ? response.id : normalizedSurveyId,
    title: typeof response.title === 'string' && response.title.trim() ? response.title : '(No title)',
    question_count: typeof response.question_count === 'number' ? response.question_count : 0,
    response_count: typeof response.response_count === 'number' ? response.response_count : 0,
  };
}

export async function getResponses(
  token: string,
  surveyId: string
): Promise<Array<{ id: string; date_created: string; total_time: number }>> {
  const normalizedSurveyId = normalizeRequired(surveyId, 'survey_id');
  const response = await surveyMonkeyRequest<SurveyMonkeyResponsesResponse>(
    `/surveys/${encodeURIComponent(normalizedSurveyId)}/responses/bulk?per_page=10`,
    token,
    'SurveyMonkeyの回答一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((item) => ({
    id: typeof item.id === 'string' ? item.id : '',
    date_created: typeof item.date_created === 'string' ? item.date_created : '',
    total_time: typeof item.total_time === 'number' ? item.total_time : 0,
  }));
}
