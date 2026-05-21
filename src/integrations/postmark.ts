import { IntegrationError } from './errors';

const POSTMARK_API_BASE_URL = 'https://api.postmarkapp.com';

type PostmarkSendResponse = {
  MessageID?: string;
  SubmittedAt?: string;
  Message?: string;
  ErrorCode?: number;
};

type PostmarkStatsResponse = {
  Sent?: number;
  Bounced?: number;
  Opens?: number;
  Clicks?: number;
  SpamComplaints?: number;
  Message?: string;
  ErrorCode?: number;
};

type PostmarkTemplatesResponse = {
  Templates?: Array<{
    TemplateId?: number;
    Name?: string;
    Active?: boolean;
    TemplateType?: string;
  }>;
  Message?: string;
  ErrorCode?: number;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Postmarkのserver tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeText(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Postmarkの${fieldName}を指定してください。`);
  }

  return trimmed;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { Message?: unknown }).Message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function postmarkRequest<T>(
  path: string,
  token: string,
  options: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${POSTMARK_API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'X-Postmark-Server-Token': normalizeToken(token),
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

  return payload as T;
}

export async function sendEmail(
  token: string,
  from: string,
  to: string,
  subject: string,
  textBody: string,
  htmlBody?: string
): Promise<{ MessageID: string; SubmittedAt: string }> {
  const payload = await postmarkRequest<PostmarkSendResponse>(
    '/email',
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: normalizeText(from, 'from'),
        To: normalizeText(to, 'to'),
        Subject: normalizeText(subject, 'subject'),
        TextBody: normalizeText(textBody, 'body'),
        HtmlBody: htmlBody?.trim() || '',
      }),
    },
    'Postmarkのメール送信に失敗しました。'
  );

  return {
    MessageID: typeof payload.MessageID === 'string' ? payload.MessageID : '',
    SubmittedAt: typeof payload.SubmittedAt === 'string' ? payload.SubmittedAt : '',
  };
}

export async function getStats(token: string): Promise<{
  Sent: number;
  Bounced: number;
  Opens: number;
  Clicks: number;
  SpamComplaints: number;
}> {
  const payload = await postmarkRequest<PostmarkStatsResponse>(
    '/stats/outbound',
    token,
    {
      method: 'GET',
    },
    'Postmarkの統計取得に失敗しました。'
  );

  return {
    Sent: typeof payload.Sent === 'number' ? payload.Sent : 0,
    Bounced: typeof payload.Bounced === 'number' ? payload.Bounced : 0,
    Opens: typeof payload.Opens === 'number' ? payload.Opens : 0,
    Clicks: typeof payload.Clicks === 'number' ? payload.Clicks : 0,
    SpamComplaints: typeof payload.SpamComplaints === 'number' ? payload.SpamComplaints : 0,
  };
}

export async function listTemplates(
  token: string
): Promise<Array<{ TemplateId: number; Name: string; Active: boolean; TemplateType: string }>> {
  const payload = await postmarkRequest<PostmarkTemplatesResponse>(
    '/templates?count=20',
    token,
    {
      method: 'GET',
    },
    'Postmarkのテンプレート一覧取得に失敗しました。'
  );

  return (payload.Templates ?? []).map((template) => ({
    TemplateId: typeof template.TemplateId === 'number' ? template.TemplateId : 0,
    Name: typeof template.Name === 'string' && template.Name.trim() ? template.Name : '(No name)',
    Active: template.Active === true,
    TemplateType: typeof template.TemplateType === 'string' ? template.TemplateType : '',
  }));
}
