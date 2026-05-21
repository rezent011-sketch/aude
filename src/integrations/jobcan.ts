import { IntegrationError } from './errors';

const JOBCAN_API_BASE_URL = 'https://ssl.jobcan.jp/api';

type JobcanStaffResponse = {
  result?: number;
  staffs?: Array<{
    staff_id?: number;
    name?: string;
    group_name?: string;
  }>;
};

type JobcanAttendanceResponse = {
  result?: number;
  attendances?: Array<{
    date?: string;
    work_time?: string;
    early_over_time?: string;
  }>;
};

type JobcanAditResponse = {
  result?: number;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Jobcan APIトークンが設定されていません。');
  }

  return trimmed;
}

async function jobcanRequest<T>(path: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${JOBCAN_API_BASE_URL}${path}`);
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new IntegrationError(fallbackMessage);
  }

  return payload as T;
}

async function jobcanFormRequest<T>(
  path: string,
  body: URLSearchParams,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${JOBCAN_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
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

export async function getStaffList(
  token: string
): Promise<Array<{ id: number; name: string; group_name: string }>> {
  const searchParams = new URLSearchParams({ token: normalizeToken(token) });
  const response = await jobcanRequest<JobcanStaffResponse>(
    `/staff?${searchParams.toString()}`,
    'Jobcanのスタッフ一覧取得に失敗しました。'
  );

  if (response.result !== 1) {
    throw new IntegrationError('Jobcanのスタッフ一覧取得に失敗しました。');
  }

  return (response.staffs ?? []).map((staff) => ({
    id: typeof staff.staff_id === 'number' ? staff.staff_id : 0,
    name: typeof staff.name === 'string' && staff.name.trim() ? staff.name : '(No name)',
    group_name:
      typeof staff.group_name === 'string' && staff.group_name.trim()
        ? staff.group_name
        : '-',
  }));
}

export async function getAttendance(
  token: string,
  staffId: number,
  year: number,
  month: number
): Promise<Array<{ date: string; work_time: string; early_over_time: string }>> {
  if (!Number.isInteger(staffId) || staffId <= 0) {
    throw new IntegrationError('Jobcanのstaff_idは正の整数で指定してください。');
  }

  if (!Number.isInteger(year) || year <= 0) {
    throw new IntegrationError('Jobcanのyearは正の整数で指定してください。');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new IntegrationError('Jobcanのmonthは1から12の整数で指定してください。');
  }

  const searchParams = new URLSearchParams({
    token: normalizeToken(token),
    staff_id: String(staffId),
    year: String(year),
    month: String(month),
  });
  const response = await jobcanRequest<JobcanAttendanceResponse>(
    `/attendance?${searchParams.toString()}`,
    'Jobcanの勤怠データ取得に失敗しました。'
  );

  if (response.result !== 1) {
    throw new IntegrationError('Jobcanの勤怠データ取得に失敗しました。');
  }

  return (response.attendances ?? []).map((attendance) => ({
    date: typeof attendance.date === 'string' ? attendance.date : '',
    work_time: typeof attendance.work_time === 'string' ? attendance.work_time : '',
    early_over_time:
      typeof attendance.early_over_time === 'string' ? attendance.early_over_time : '',
  }));
}

export async function clockIn(token: string, note?: string): Promise<void> {
  const body = new URLSearchParams({
    token: normalizeToken(token),
    adit_type: 'work_start',
  });

  if (typeof note === 'string' && note.trim()) {
    body.set('note', note.trim());
  }

  const response = await jobcanFormRequest<JobcanAditResponse>(
    '/adit',
    body,
    'Jobcanの出勤打刻に失敗しました。'
  );

  if (response.result !== 1) {
    throw new IntegrationError('Jobcanの出勤打刻に失敗しました。');
  }
}

export async function clockOut(token: string, note?: string): Promise<void> {
  const body = new URLSearchParams({
    token: normalizeToken(token),
    adit_type: 'work_end',
  });

  if (typeof note === 'string' && note.trim()) {
    body.set('note', note.trim());
  }

  const response = await jobcanFormRequest<JobcanAditResponse>(
    '/adit',
    body,
    'Jobcanの退勤打刻に失敗しました。'
  );

  if (response.result !== 1) {
    throw new IntegrationError('Jobcanの退勤打刻に失敗しました。');
  }
}
