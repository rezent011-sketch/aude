import { IntegrationError } from './errors';

const WANTEDLY_API_BASE_URL = 'https://www.wantedly.com/api/v1';

type WantedlyCompanyResponse = {
  company?: {
    id?: number;
    name?: string;
    description?: string;
  };
  error?: string;
  message?: string;
};

type WantedlyJobPostingsResponse = {
  job_postings?: Array<{
    id?: number;
    title?: string;
    status?: string;
    applicants_count?: number;
  }>;
  error?: string;
  message?: string;
};

type WantedlyApplicantsResponse = {
  applicants?: Array<{
    id?: number;
    name?: string;
    status?: string;
    created_at?: string;
  }>;
  error?: string;
  message?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Wantedlyのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeJobPostingId(jobPostingId: number): number {
  if (!Number.isInteger(jobPostingId) || jobPostingId <= 0) {
    throw new IntegrationError('Wantedlyのjob_idは正の整数で指定してください。');
  }

  return jobPostingId;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return null;
}

async function wantedlyRequest<T>(
  path: string,
  token: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${WANTEDLY_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizeToken(token)}`,
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

export async function getCompanyProfile(
  token: string
): Promise<{ id: number; name: string; description: string }> {
  const response = await wantedlyRequest<WantedlyCompanyResponse>(
    '/companies/me',
    token,
    'Wantedlyの企業プロフィール取得に失敗しました。'
  );

  return {
    id: typeof response.company?.id === 'number' ? response.company.id : 0,
    name:
      typeof response.company?.name === 'string' && response.company.name.trim()
        ? response.company.name
        : '(No name)',
    description:
      typeof response.company?.description === 'string' ? response.company.description : '',
  };
}

export async function getJobPostings(
  token: string
): Promise<Array<{ id: number; title: string; status: string; applicants_count: number }>> {
  const response = await wantedlyRequest<WantedlyJobPostingsResponse>(
    '/job_postings',
    token,
    'Wantedlyの求人一覧取得に失敗しました。'
  );

  return (response.job_postings ?? []).map((jobPosting) => ({
    id: typeof jobPosting.id === 'number' ? jobPosting.id : 0,
    title:
      typeof jobPosting.title === 'string' && jobPosting.title.trim()
        ? jobPosting.title
        : '(No title)',
    status:
      typeof jobPosting.status === 'string' && jobPosting.status.trim()
        ? jobPosting.status
        : 'unknown',
    applicants_count:
      typeof jobPosting.applicants_count === 'number' ? jobPosting.applicants_count : 0,
  }));
}

export async function getApplicants(
  token: string,
  jobPostingId: number
): Promise<Array<{ id: number; name: string; status: string; applied_at: string }>> {
  const response = await wantedlyRequest<WantedlyApplicantsResponse>(
    `/job_postings/${normalizeJobPostingId(jobPostingId)}/applicants`,
    token,
    'Wantedlyの応募者一覧取得に失敗しました。'
  );

  return (response.applicants ?? []).map((applicant) => ({
    id: typeof applicant.id === 'number' ? applicant.id : 0,
    name:
      typeof applicant.name === 'string' && applicant.name.trim()
        ? applicant.name
        : '(No name)',
    status:
      typeof applicant.status === 'string' && applicant.status.trim()
        ? applicant.status
        : 'unknown',
    applied_at: typeof applicant.created_at === 'string' ? applicant.created_at : '',
  }));
}
