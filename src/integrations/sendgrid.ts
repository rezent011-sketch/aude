import { IntegrationError } from './errors';

const SENDGRID_API_BASE_URL = 'https://api.sendgrid.com/v3';

type SendGridErrorResponse = {
  errors?: Array<{
    message?: string;
  }>;
};

type SendGridStatsResponse = Array<{
  date?: string;
  stats?: Array<{
    metrics?: {
      delivered?: number;
      opens?: number;
      clicks?: number;
    };
  }>;
}>;

type SendGridListsResponse = {
  result?: Array<{
    id?: string;
    name?: string;
    contact_count?: number;
  }>;
};

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('SendGridのAPI keyが設定されていません。');
  }

  return trimmed;
}

function normalizeEmail(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`SendGridの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function normalizeText(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`SendGridの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const errors = (payload as SendGridErrorResponse).errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  const message = errors
    .map((error) => (typeof error.message === 'string' ? error.message.trim() : ''))
    .find((error) => error);

  return message || null;
}

async function sendGridRequest<T>(
  path: string,
  apiKey: string,
  options: RequestInit,
  fallbackMessage: string
): Promise<{ response: Response; payload: T | null }> {
  let response: Response;

  try {
    response = await fetch(`${SENDGRID_API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${normalizeApiKey(apiKey)}`,
        ...(options.headers ?? {}),
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

  return { response, payload };
}

export async function sendEmail(
  apiKey: string,
  to: string,
  from: string,
  subject: string,
  text: string,
  html?: string
): Promise<void> {
  const content = [{ type: 'text/plain', value: normalizeText(text, 'message') }];
  const normalizedHtml = html?.trim();

  if (normalizedHtml) {
    content.push({ type: 'text/html', value: normalizedHtml });
  }

  const { response } = await sendGridRequest<unknown>(
    '/mail/send',
    apiKey,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: normalizeEmail(to, 'to') }] }],
        from: { email: normalizeEmail(from, 'from_email') },
        subject: normalizeText(subject, 'subject'),
        content,
      }),
    },
    'SendGridのメール送信に失敗しました。'
  );

  if (response.status !== 202) {
    throw new IntegrationError('SendGridのメール送信に失敗しました。');
  }
}

export async function getStats(
  apiKey: string,
  startDate: string
): Promise<Array<{ date: string; delivered: number; opens: number; clicks: number }>> {
  const normalizedStartDate = normalizeText(startDate, 'start_date');
  const { payload } = await sendGridRequest<SendGridStatsResponse>(
    `/stats?start_date=${encodeURIComponent(normalizedStartDate)}&aggregated_by=day`,
    apiKey,
    {
      method: 'GET',
    },
    'SendGridの配信統計取得に失敗しました。'
  );

  return (payload ?? []).map((entry) => ({
    date: typeof entry.date === 'string' ? entry.date : '',
    delivered: typeof entry.stats?.[0]?.metrics?.delivered === 'number' ? entry.stats[0].metrics.delivered : 0,
    opens: typeof entry.stats?.[0]?.metrics?.opens === 'number' ? entry.stats[0].metrics.opens : 0,
    clicks: typeof entry.stats?.[0]?.metrics?.clicks === 'number' ? entry.stats[0].metrics.clicks : 0,
  }));
}

export async function getLists(
  apiKey: string
): Promise<Array<{ id: string; name: string; contact_count: number }>> {
  const { payload } = await sendGridRequest<SendGridListsResponse>(
    '/marketing/lists',
    apiKey,
    {
      method: 'GET',
    },
    'SendGridのリスト一覧取得に失敗しました。'
  );

  return (payload?.result ?? []).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : '',
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : '(No name)',
    contact_count: typeof entry.contact_count === 'number' ? entry.contact_count : 0,
  }));
}
