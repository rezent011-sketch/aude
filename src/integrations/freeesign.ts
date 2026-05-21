import { IntegrationError } from './errors';

const FREEESIGN_API_BASE_URL = 'https://api.freeesign.jp/v2';

type FreeeSignContractsResponse = {
  contracts?: Array<{
    id?: string;
    title?: string;
    status?: string;
    created_at?: string;
  }>;
};

type FreeeSignContractResponse = {
  contract?: {
    id?: string;
    title?: string;
    status?: string;
    created_at?: string;
    signers?: Array<{
      email?: string;
      status?: string;
      signed_at?: string | null;
    }>;
  };
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('freeeサインのAPIトークンが設定されていません。');
  }

  return trimmed;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function freeeSignRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${FREEESIGN_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
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

export async function getContracts(
  token: string
): Promise<Array<{ id: string; title: string; status: string; created_at: string }>> {
  const response = await freeeSignRequest<FreeeSignContractsResponse>(
    '/contracts',
    token,
    { method: 'GET' },
    'freeeサインの契約書一覧取得に失敗しました。'
  );

  return (response.contracts ?? []).map((contract) => ({
    id: typeof contract.id === 'string' ? contract.id : '',
    title: typeof contract.title === 'string' && contract.title.trim() ? contract.title : '(No title)',
    status: typeof contract.status === 'string' && contract.status.trim() ? contract.status : 'unknown',
    created_at: typeof contract.created_at === 'string' ? contract.created_at : '',
  }));
}

export async function getContract(
  token: string,
  id: string
): Promise<{
  id: string;
  title: string;
  status: string;
  signers: Array<{ email: string; status: string; signed_at: string | null }>;
}> {
  const normalizedId = id.trim();

  if (!normalizedId) {
    throw new IntegrationError('freeeサインのcontract IDを指定してください。');
  }

  const response = await freeeSignRequest<FreeeSignContractResponse>(
    `/contracts/${encodeURIComponent(normalizedId)}`,
    token,
    { method: 'GET' },
    'freeeサインの契約書詳細取得に失敗しました。'
  );

  return {
    id: typeof response.contract?.id === 'string' ? response.contract.id : normalizedId,
    title:
      typeof response.contract?.title === 'string' && response.contract.title.trim()
        ? response.contract.title
        : '(No title)',
    status:
      typeof response.contract?.status === 'string' && response.contract.status.trim()
        ? response.contract.status
        : 'unknown',
    signers: (response.contract?.signers ?? []).map((signer) => ({
      email: typeof signer.email === 'string' && signer.email.trim() ? signer.email : '(No email)',
      status: typeof signer.status === 'string' && signer.status.trim() ? signer.status : 'unknown',
      signed_at: typeof signer.signed_at === 'string' ? signer.signed_at : null,
    })),
  };
}

export async function createContract(
  token: string,
  title: string,
  signerEmails: string[]
): Promise<{ id: string; title: string }> {
  const normalizedTitle = title.trim();
  const normalizedSignerEmails = signerEmails.map((email) => email.trim()).filter((email) => email);

  if (!normalizedTitle) {
    throw new IntegrationError('freeeサインのtitleを指定してください。');
  }

  if (normalizedSignerEmails.length === 0) {
    throw new IntegrationError('freeeサインの署名者メールアドレスを指定してください。');
  }

  const response = await freeeSignRequest<FreeeSignContractResponse>(
    '/contracts',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        title: normalizedTitle,
        signers: normalizedSignerEmails.map((email) => ({ email })),
      }),
    },
    'freeeサインの契約書作成に失敗しました。'
  );

  return {
    id: typeof response.contract?.id === 'string' ? response.contract.id : '',
    title:
      typeof response.contract?.title === 'string' && response.contract.title.trim()
        ? response.contract.title
        : normalizedTitle,
  };
}
