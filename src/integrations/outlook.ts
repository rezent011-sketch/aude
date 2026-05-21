import { IntegrationError } from './errors';
import { fetchJson } from './http';

const MICROSOFT_GRAPH_ME_BASE_URL = 'https://graph.microsoft.com/v1.0/me';

type OutlookMessagesResponse = {
  value?: Array<{
    id?: string;
    subject?: string;
    from?: {
      emailAddress?: {
        address?: string;
      };
    };
    receivedDateTime?: string;
    isRead?: boolean;
  }>;
};

type OutlookCalendarEventsResponse = {
  value?: Array<{
    id?: string;
    subject?: string;
    start?: {
      dateTime?: string;
    };
    end?: {
      dateTime?: string;
    };
    location?: {
      displayName?: string;
    };
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Outlookのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function getHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${normalizeToken(token)}`,
    'Content-Type': 'application/json',
  };
}

export async function getEmails(
  token: string,
  top?: number
): Promise<
  Array<{
    id: string;
    subject: string;
    from: string;
    receivedDateTime: string;
    isRead: boolean;
  }>
> {
  const normalizedTop = typeof top === 'number' && Number.isFinite(top) && top > 0 ? Math.floor(top) : 10;
  const response = await fetchJson<OutlookMessagesResponse>(
    `${MICROSOFT_GRAPH_ME_BASE_URL}/messages?$top=${normalizedTop}&$orderby=${encodeURIComponent('receivedDateTime desc')}`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Outlookのメール一覧取得に失敗しました。'
  );

  return (response.value ?? []).map((message) => ({
    id: typeof message.id === 'string' ? message.id : '',
    subject:
      typeof message.subject === 'string' && message.subject.trim()
        ? message.subject
        : '(No subject)',
    from: typeof message.from?.emailAddress?.address === 'string' ? message.from.emailAddress.address : '',
    receivedDateTime:
      typeof message.receivedDateTime === 'string' ? message.receivedDateTime : '',
    isRead: message.isRead === true,
  }));
}

export async function sendEmail(
  token: string,
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const normalizedTo = to.trim();
  const normalizedSubject = subject.trim();
  const normalizedBody = body.trim();

  if (!normalizedTo) {
    throw new IntegrationError('Outlookの送信先toを指定してください。');
  }

  if (!normalizedSubject) {
    throw new IntegrationError('Outlookのsubjectを指定してください。');
  }

  if (!normalizedBody) {
    throw new IntegrationError('Outlookのbodyを指定してください。');
  }

  await fetchJson(
    `${MICROSOFT_GRAPH_ME_BASE_URL}/sendMail`,
    {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({
        message: {
          subject: normalizedSubject,
          body: {
            contentType: 'Text',
            content: normalizedBody,
          },
          toRecipients: [
            {
              emailAddress: {
                address: normalizedTo,
              },
            },
          ],
        },
      }),
    },
    'Outlookメールの送信に失敗しました。'
  );
}

export async function getCalendarEvents(
  token: string
): Promise<Array<{ id: string; subject: string; start: string; end: string; location: string }>> {
  const response = await fetchJson<OutlookCalendarEventsResponse>(
    `${MICROSOFT_GRAPH_ME_BASE_URL}/calendar/events?$top=10`,
    {
      method: 'GET',
      headers: getHeaders(token),
    },
    'Outlookの予定一覧取得に失敗しました。'
  );

  return (response.value ?? []).map((event) => ({
    id: typeof event.id === 'string' ? event.id : '',
    subject:
      typeof event.subject === 'string' && event.subject.trim()
        ? event.subject
        : '(No subject)',
    start: typeof event.start?.dateTime === 'string' ? event.start.dateTime : '',
    end: typeof event.end?.dateTime === 'string' ? event.end.dateTime : '',
    location:
      typeof event.location?.displayName === 'string' ? event.location.displayName : '',
  }));
}
