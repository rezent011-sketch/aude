import { IntegrationError } from './errors';

const DOCUSIGN_API_BASE_URL = 'https://demo.docusign.net/restapi/v2.1';

type DocusignEnvelopesResponse = {
  envelopes?: Array<{
    envelopeId?: string;
    emailSubject?: string;
    status?: string;
    sentDateTime?: string;
  }>;
};

type DocusignEnvelopeResponse = {
  envelopeId?: string;
  emailSubject?: string;
  status?: string;
};

type DocusignRecipientsResponse = {
  signers?: Array<{
    name?: string;
    email?: string;
    status?: string;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('DocuSignのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function normalizeAccountId(accountId: string): string {
  const trimmed = accountId.trim();

  if (!trimmed) {
    throw new IntegrationError('DocuSignのaccount IDが設定されていません。');
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const errorCode = (payload as { errorCode?: unknown }).errorCode;
  return typeof errorCode === 'string' && errorCode.trim() ? errorCode : null;
}

async function docusignRequest<T>(
  accountId: string,
  path: string,
  token: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      `${DOCUSIGN_API_BASE_URL}/accounts/${encodeURIComponent(normalizeAccountId(accountId))}${path}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${normalizeToken(token)}`,
          'Content-Type': 'application/json',
        },
      }
    );
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

export async function getEnvelopes(
  token: string,
  accountId: string
): Promise<Array<{ envelopeId: string; subject: string; status: string; sentDateTime: string }>> {
  const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const response = await docusignRequest<DocusignEnvelopesResponse>(
    accountId,
    `/envelopes?from_date=${encodeURIComponent(fromDate)}`,
    token,
    'DocuSignの封筒一覧取得に失敗しました。'
  );

  return (response.envelopes ?? []).map((envelope) => ({
    envelopeId: typeof envelope.envelopeId === 'string' ? envelope.envelopeId : '',
    subject:
      typeof envelope.emailSubject === 'string' && envelope.emailSubject.trim()
        ? envelope.emailSubject
        : '(No subject)',
    status: typeof envelope.status === 'string' && envelope.status.trim() ? envelope.status : 'unknown',
    sentDateTime: typeof envelope.sentDateTime === 'string' ? envelope.sentDateTime : '',
  }));
}

export async function getEnvelope(
  token: string,
  accountId: string,
  envelopeId: string
): Promise<{
  envelopeId: string;
  subject: string;
  status: string;
  recipients: Array<{ name: string; email: string; status: string }>;
}> {
  const normalizedEnvelopeId = envelopeId.trim();

  if (!normalizedEnvelopeId) {
    throw new IntegrationError('DocuSignのenvelope IDを指定してください。');
  }

  const [envelope, recipients] = await Promise.all([
    docusignRequest<DocusignEnvelopeResponse>(
      accountId,
      `/envelopes/${encodeURIComponent(normalizedEnvelopeId)}`,
      token,
      'DocuSignの封筒詳細取得に失敗しました。'
    ),
    docusignRequest<DocusignRecipientsResponse>(
      accountId,
      `/envelopes/${encodeURIComponent(normalizedEnvelopeId)}/recipients`,
      token,
      'DocuSignの署名者一覧取得に失敗しました。'
    ),
  ]);

  return {
    envelopeId:
      typeof envelope.envelopeId === 'string' ? envelope.envelopeId : normalizedEnvelopeId,
    subject:
      typeof envelope.emailSubject === 'string' && envelope.emailSubject.trim()
        ? envelope.emailSubject
        : '(No subject)',
    status: typeof envelope.status === 'string' && envelope.status.trim() ? envelope.status : 'unknown',
    recipients: (recipients.signers ?? []).map((signer) => ({
      name: typeof signer.name === 'string' && signer.name.trim() ? signer.name : '(No name)',
      email: typeof signer.email === 'string' && signer.email.trim() ? signer.email : '(No email)',
      status: typeof signer.status === 'string' && signer.status.trim() ? signer.status : 'unknown',
    })),
  };
}
