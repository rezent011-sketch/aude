import { IntegrationError } from './errors';

const MFPAYROLL_API_BASE_URL = 'https://payroll.moneyforward.com/api/v1';

type MfPayrollEmployeesResponse = {
  data?: Array<{
    id?: string;
    display_name?: string;
    department?: {
      name?: string;
    } | null;
    employment_type?: string;
  }>;
  message?: string;
};

type MfPayrollPayslipsResponse = {
  data?: Array<{
    employee_id?: string;
    employee_display_name?: string;
    net_amount?: number;
  }>;
  message?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Money Forwardクラウド給与のaccess tokenが設定されていません。');
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

async function mfPayrollRequest<T>(path: string, token: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${MFPAYROLL_API_BASE_URL}${path}`, {
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
  token: string
): Promise<
  Array<{ id: string; display_name: string; department_name: string; employment_type: string }>
> {
  const response = await mfPayrollRequest<MfPayrollEmployeesResponse>(
    '/employees',
    token,
    'Money Forwardクラウド給与の従業員一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((employee) => ({
    id: typeof employee.id === 'string' ? employee.id : '',
    display_name:
      typeof employee.display_name === 'string' && employee.display_name.trim()
        ? employee.display_name
        : '(No name)',
    department_name:
      typeof employee.department?.name === 'string' && employee.department.name.trim()
        ? employee.department.name
        : '',
    employment_type:
      typeof employee.employment_type === 'string' && employee.employment_type.trim()
        ? employee.employment_type
        : '',
  }));
}

export async function getPayslips(
  token: string,
  year: number,
  month: number
): Promise<Array<{ employee_id: string; employee_name: string; net_amount: number }>> {
  const searchParams = new URLSearchParams({
    year: String(normalizePositiveInteger(year, 'Money Forwardクラウド給与のyear')),
    month: String(normalizePositiveInteger(month, 'Money Forwardクラウド給与のmonth')),
  });

  const response = await mfPayrollRequest<MfPayrollPayslipsResponse>(
    `/payslips?${searchParams.toString()}`,
    token,
    'Money Forwardクラウド給与の給与明細一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((payslip) => ({
    employee_id: typeof payslip.employee_id === 'string' ? payslip.employee_id : '',
    employee_name:
      typeof payslip.employee_display_name === 'string' ? payslip.employee_display_name : '',
    net_amount: typeof payslip.net_amount === 'number' ? payslip.net_amount : 0,
  }));
}
