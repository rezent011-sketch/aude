import { IntegrationError } from './errors';

const FREEE_HR_API_BASE_URL = 'https://api.freee.co.jp/hr/api/v1';

type FreeeHrEmployeesResponse = {
  employees?: Array<{
    id?: number;
    display_name?: string;
    entry_date?: string;
    department?: {
      name?: string;
    } | null;
  }>;
  message?: string;
};

type FreeeHrPayrollsResponse = {
  employee_payroll_statements?: Array<{
    employee_id?: number;
    employee_display_name?: string;
    total_amount?: number;
  }>;
  message?: string;
};

type FreeeHrWorkRecordSummaryResponse = {
  total_work_mins?: number;
  total_overtime_work_mins?: number;
  message?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('freee人事労務のaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new IntegrationError(`${label}は正の整数で指定してください。`);
  }

  return value;
}

function extractMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

async function freeeHrRequest<T>(
  path: string,
  token: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${FREEE_HR_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizeToken(token)}`,
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
  token: string,
  companyId: number
): Promise<Array<{ id: number; display_name: string; entry_date: string; department: string }>> {
  const searchParams = new URLSearchParams({
    company_id: String(normalizePositiveInteger(companyId, 'freee人事労務のcompany_id')),
  });

  const response = await freeeHrRequest<FreeeHrEmployeesResponse>(
    `/employees?${searchParams.toString()}`,
    token,
    'freee人事労務の従業員一覧取得に失敗しました。'
  );

  return (response.employees ?? []).map((employee) => ({
    id: typeof employee.id === 'number' ? employee.id : 0,
    display_name:
      typeof employee.display_name === 'string' && employee.display_name.trim()
        ? employee.display_name
        : '(No name)',
    entry_date: typeof employee.entry_date === 'string' ? employee.entry_date : '',
    department:
      typeof employee.department?.name === 'string' && employee.department.name.trim()
        ? employee.department.name
        : '',
  }));
}

export async function getPayrolls(
  token: string,
  companyId: number,
  year: number,
  month: number
): Promise<Array<{ employee_id: number; employee_name: string; total_amount: number }>> {
  const searchParams = new URLSearchParams({
    company_id: String(normalizePositiveInteger(companyId, 'freee人事労務のcompany_id')),
    year: String(normalizePositiveInteger(year, 'freee人事労務のyear')),
    month: String(normalizePositiveInteger(month, 'freee人事労務のmonth')),
  });

  const response = await freeeHrRequest<FreeeHrPayrollsResponse>(
    `/salaries/employee_payroll_statements?${searchParams.toString()}`,
    token,
    'freee人事労務の給与一覧取得に失敗しました。'
  );

  return (response.employee_payroll_statements ?? []).map((payroll) => ({
    employee_id: typeof payroll.employee_id === 'number' ? payroll.employee_id : 0,
    employee_name:
      typeof payroll.employee_display_name === 'string' ? payroll.employee_display_name : '',
    total_amount: typeof payroll.total_amount === 'number' ? payroll.total_amount : 0,
  }));
}

export async function getWorkRecords(
  token: string,
  companyId: number,
  employeeId: number,
  year: number,
  month: number
): Promise<{ total_work_mins: number; total_overtime_work_mins: number }> {
  const normalizedCompanyId = normalizePositiveInteger(companyId, 'freee人事労務のcompany_id');
  const normalizedEmployeeId = normalizePositiveInteger(employeeId, 'freee人事労務のemployee_id');
  const normalizedYear = normalizePositiveInteger(year, 'freee人事労務のyear');
  const normalizedMonth = normalizePositiveInteger(month, 'freee人事労務のmonth');

  const searchParams = new URLSearchParams({
    company_id: String(normalizedCompanyId),
  });

  const response = await freeeHrRequest<FreeeHrWorkRecordSummaryResponse>(
    `/employees/${normalizedEmployeeId}/work_record_summaries/${normalizedYear}/${normalizedMonth}?${searchParams.toString()}`,
    token,
    'freee人事労務の勤怠サマリ取得に失敗しました。'
  );

  return {
    total_work_mins: typeof response.total_work_mins === 'number' ? response.total_work_mins : 0,
    total_overtime_work_mins:
      typeof response.total_overtime_work_mins === 'number'
        ? response.total_overtime_work_mins
        : 0,
  };
}
