import { IntegrationError } from './errors';

const YAYOI_API_BASE_URL = 'https://api.yayoi-kk.co.jp/v1';

type YayoiTrialBalanceResponse = {
  items?: Array<{
    account_name?: string;
    debit_amount?: number;
    credit_amount?: number;
    balance?: number;
  }>;
};

type YayoiJournalEntriesResponse = {
  journal_entries?: Array<{
    id?: string;
    date?: string;
    debit_account?: string;
    credit_account?: string;
    amount?: number;
    description?: string;
  }>;
};

type YayoiJournalEntryResponse = {
  journal_entry?: {
    id?: string;
  };
  message?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('弥生会計のアクセストークンが設定されていません。');
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

async function yayoiRequest<T>(
  path: string,
  token: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${YAYOI_API_BASE_URL}${path}`, {
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

export async function getTrialBalance(
  token: string
): Promise<
  Array<{ account_name: string; debit_amount: number; credit_amount: number; balance: number }>
> {
  const response = await yayoiRequest<YayoiTrialBalanceResponse>(
    '/trial_balance',
    token,
    { method: 'GET' },
    '弥生会計の試算表取得に失敗しました。'
  );

  return (response.items ?? []).map((item) => ({
    account_name:
      typeof item.account_name === 'string' && item.account_name.trim()
        ? item.account_name
        : '(No account)',
    debit_amount: typeof item.debit_amount === 'number' ? item.debit_amount : 0,
    credit_amount: typeof item.credit_amount === 'number' ? item.credit_amount : 0,
    balance: typeof item.balance === 'number' ? item.balance : 0,
  }));
}

export async function getJournalEntries(
  token: string,
  from?: string,
  to?: string
): Promise<
  Array<{
    id: string;
    date: string;
    debit_account: string;
    credit_account: string;
    amount: number;
    description: string;
  }>
> {
  const searchParams = new URLSearchParams();

  if (typeof from === 'string' && from.trim()) {
    searchParams.set('from', from.trim());
  }

  if (typeof to === 'string' && to.trim()) {
    searchParams.set('to', to.trim());
  }

  const query = searchParams.toString();
  const response = await yayoiRequest<YayoiJournalEntriesResponse>(
    `/journal_entries${query ? `?${query}` : ''}`,
    token,
    { method: 'GET' },
    '弥生会計の仕訳一覧取得に失敗しました。'
  );

  return (response.journal_entries ?? []).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : '',
    date: typeof entry.date === 'string' ? entry.date : '',
    debit_account:
      typeof entry.debit_account === 'string' && entry.debit_account.trim()
        ? entry.debit_account
        : '(No debit account)',
    credit_account:
      typeof entry.credit_account === 'string' && entry.credit_account.trim()
        ? entry.credit_account
        : '(No credit account)',
    amount: typeof entry.amount === 'number' ? entry.amount : 0,
    description: typeof entry.description === 'string' ? entry.description : '',
  }));
}

export async function createJournalEntry(
  token: string,
  date: string,
  debitAccount: string,
  creditAccount: string,
  amount: number,
  description: string
): Promise<{ id: string }> {
  const normalizedDate = date.trim();
  const normalizedDebitAccount = debitAccount.trim();
  const normalizedCreditAccount = creditAccount.trim();

  if (!normalizedDate) {
    throw new IntegrationError('弥生会計のdateを指定してください。');
  }

  if (!normalizedDebitAccount) {
    throw new IntegrationError('弥生会計の借方勘定科目を指定してください。');
  }

  if (!normalizedCreditAccount) {
    throw new IntegrationError('弥生会計の貸方勘定科目を指定してください。');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new IntegrationError('弥生会計のamountは正の数で指定してください。');
  }

  const response = await yayoiRequest<YayoiJournalEntryResponse>(
    '/journal_entries',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        date: normalizedDate,
        debit_account: normalizedDebitAccount,
        credit_account: normalizedCreditAccount,
        amount,
        description: description.trim(),
      }),
    },
    '弥生会計の仕訳作成に失敗しました。'
  );

  return {
    id: typeof response.journal_entry?.id === 'string' ? response.journal_entry.id : '',
  };
}
