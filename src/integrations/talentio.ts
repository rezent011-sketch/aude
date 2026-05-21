import { IntegrationError } from './errors';

const TALENTIO_API_BASE_URL = 'https://talentio.com/api/v1';

type TalentioJobsResponse = {
  jobs?: Array<{
    id?: number;
    name?: string;
    status?: string;
  }>;
};

type TalentioCandidatesResponse = {
  candidates?: Array<{
    id?: number;
    name?: string;
    current_progress_name?: string;
    applied_at?: string;
  }>;
};

type TalentioCandidateResponse = {
  candidate?: {
    id?: number;
    name?: string;
    email?: string;
    current_progress_name?: string;
    job?: {
      name?: string;
    };
  };
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Talentioアクセストークンが設定されていません。');
  }

  return trimmed;
}

async function talentioRequest<T>(
  path: string,
  token: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${TALENTIO_API_BASE_URL}${path}`, {
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
    throw new IntegrationError(fallbackMessage);
  }

  return payload as T;
}

export async function getJobs(
  token: string
): Promise<Array<{ id: number; name: string; status: string }>> {
  const response = await talentioRequest<TalentioJobsResponse>(
    '/jobs',
    token,
    'Talentioの求人一覧取得に失敗しました。'
  );

  return (response.jobs ?? []).map((job) => ({
    id: typeof job.id === 'number' ? job.id : 0,
    name: typeof job.name === 'string' && job.name.trim() ? job.name : '(No name)',
    status: typeof job.status === 'string' && job.status.trim() ? job.status : '-',
  }));
}

export async function getCandidates(
  token: string,
  jobId?: number
): Promise<Array<{ id: number; name: string; status: string; applied_at: string }>> {
  if (typeof jobId === 'number' && (!Number.isInteger(jobId) || jobId <= 0)) {
    throw new IntegrationError('Talentioのjob_idは正の整数で指定してください。');
  }

  const searchParams = new URLSearchParams();
  if (typeof jobId === 'number') {
    searchParams.set('job_id', String(jobId));
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  const response = await talentioRequest<TalentioCandidatesResponse>(
    `/candidates${suffix}`,
    token,
    'Talentioの候補者一覧取得に失敗しました。'
  );

  return (response.candidates ?? []).map((candidate) => ({
    id: typeof candidate.id === 'number' ? candidate.id : 0,
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : '(No name)',
    status:
      typeof candidate.current_progress_name === 'string' && candidate.current_progress_name.trim()
        ? candidate.current_progress_name
        : '-',
    applied_at: typeof candidate.applied_at === 'string' ? candidate.applied_at : '-',
  }));
}

export async function getCandidate(
  token: string,
  id: number
): Promise<{ id: number; name: string; email: string; status: string; job_name: string }> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new IntegrationError('Talentioの候補者IDは正の整数で指定してください。');
  }

  const response = await talentioRequest<TalentioCandidateResponse>(
    `/candidates/${id}`,
    token,
    'Talentioの候補者詳細取得に失敗しました。'
  );

  const candidate = response.candidate;
  if (!candidate) {
    throw new IntegrationError('Talentio APIレスポンスの形式が不正です。');
  }

  return {
    id: typeof candidate.id === 'number' ? candidate.id : id,
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : '(No name)',
    email: typeof candidate.email === 'string' && candidate.email.trim() ? candidate.email : '-',
    status:
      typeof candidate.current_progress_name === 'string' && candidate.current_progress_name.trim()
        ? candidate.current_progress_name
        : '-',
    job_name:
      typeof candidate.job?.name === 'string' && candidate.job.name.trim()
        ? candidate.job.name
        : '-',
  };
}
