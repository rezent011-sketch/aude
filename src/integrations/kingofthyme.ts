import { IntegrationError } from './errors';

const KING_OF_THYME_API_BASE_URL = 'https://api.kingofthyme.jp/v1';

type KingOfThymeEmployeesResponse = {
  employees?: Array<{
    employee_id?: string;
    name?: string;
    group_name?: string;
  }>;
};

type KingOfThymeDailyAttendancesResponse = {
  daily_attendances?: Array<{
    employee_id?: string;
    employee_name?: string;
    start_time?: string;
    end_time?: string;
    work_time?: string;
  }>;
};

type KingOfThymeMonthlyAttendancesResponse = {
  monthly_attendances?: Array<{
    date?: string;
    work_time?: string;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('KING OF TIMEのAPIトークンが設定されていません。');
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

async function kingOfThymeRequest<T>(
  path: string,
  token: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${KING_OF_THYME_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${normalizeToken(token)}`,
        'Content-Type': 'application/json',
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

export async function getEmployees(
  token: string
): Promise<Array<{ employee_id: string; name: string; group_name: string }>> {
  const response = await kingOfThymeRequest<KingOfThymeEmployeesResponse>(
    '/employees',
    token,
    'KING OF TIMEの従業員一覧取得に失敗しました。'
  );

  return (response.employees ?? []).map((employee) => ({
    employee_id: typeof employee.employee_id === 'string' ? employee.employee_id : '',
    name: typeof employee.name === 'string' && employee.name.trim() ? employee.name : '(No name)',
    group_name:
      typeof employee.group_name === 'string' && employee.group_name.trim()
        ? employee.group_name
        : '未所属',
  }));
}

export async function getDailyAttendance(
  token: string,
  date: string
): Promise<
  Array<{
    employee_id: string;
    name: string;
    clock_in: string;
    clock_out: string;
    work_time: string;
  }>
> {
  const normalizedDate = date.trim();

  if (!normalizedDate) {
    throw new IntegrationError('KING OF TIMEの日付を指定してください。');
  }

  const searchParams = new URLSearchParams({ date: normalizedDate });
  const response = await kingOfThymeRequest<KingOfThymeDailyAttendancesResponse>(
    `/daily_attendances?${searchParams.toString()}`,
    token,
    'KING OF TIMEの日次勤怠取得に失敗しました。'
  );

  return (response.daily_attendances ?? []).map((attendance) => ({
    employee_id: typeof attendance.employee_id === 'string' ? attendance.employee_id : '',
    name:
      typeof attendance.employee_name === 'string' && attendance.employee_name.trim()
        ? attendance.employee_name
        : '(No name)',
    clock_in: typeof attendance.start_time === 'string' ? attendance.start_time : '',
    clock_out: typeof attendance.end_time === 'string' ? attendance.end_time : '',
    work_time: typeof attendance.work_time === 'string' ? attendance.work_time : '',
  }));
}

export async function getMonthlyAttendance(
  token: string,
  employeeId: string,
  year: number,
  month: number
): Promise<Array<{ date: string; work_time: string }>> {
  const normalizedEmployeeId = employeeId.trim();

  if (!normalizedEmployeeId) {
    throw new IntegrationError('KING OF TIMEのemployee_idを指定してください。');
  }

  if (!Number.isInteger(year) || year <= 0) {
    throw new IntegrationError('KING OF TIMEのyearは正の整数で指定してください。');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new IntegrationError('KING OF TIMEのmonthは1から12で指定してください。');
  }

  const searchParams = new URLSearchParams({
    employee_id: normalizedEmployeeId,
    year: String(year),
    month: String(month),
  });
  const response = await kingOfThymeRequest<KingOfThymeMonthlyAttendancesResponse>(
    `/monthly_attendances?${searchParams.toString()}`,
    token,
    'KING OF TIMEの月次勤怠取得に失敗しました。'
  );

  return (response.monthly_attendances ?? []).map((attendance) => ({
    date: typeof attendance.date === 'string' ? attendance.date : '',
    work_time: typeof attendance.work_time === 'string' ? attendance.work_time : '',
  }));
}
