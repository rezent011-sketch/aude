=== Week48: RECEPTIONIST・freee HR・MF給与連携 ===

既存パターン（src/integrations/slack.ts / src/commands/slack.ts）を参考に実装してください。

---
=== TASK 1: RECEPTIONIST連携 ===

【src/integrations/receptionist.ts を新規作成】

RECEPTIONIST API (https://developer.receptionist.jp/) を使用。
認証: Bearer token
Base URL: https://api.receptionist.jp/v1

export async function getVisitors(token: string): Promise<Array<{ id: string; visitor_name: string; company: string; host_name: string; checked_in_at: string; status: string; }>>
  GET https://api.receptionist.jp/v1/visitors
  レスポンス: { visitors: [{ id, visitor_name, company, host_name, checked_in_at, status }] }

export async function getVisitor(token: string, id: string): Promise<{ id: string; visitor_name: string; company: string; host_name: string; purpose: string; checked_in_at: string; }>
  GET https://api.receptionist.jp/v1/visitors/{id}
  レスポンス: { visitor: { id, visitor_name, company, host_name, purpose, checked_in_at } }

export async function createVisitorNotification(token: string, hostName: string, visitorName: string, company: string): Promise<{ id: string }>
  POST https://api.receptionist.jp/v1/notifications
  body: { host_name: hostName, visitor_name: visitorName, company }
  レスポンス: { notification: { id } }

全関数: import { IntegrationError } from './errors'

【src/commands/receptionist.ts を新規作成】
コマンド名: 'receptionist', description: 'RECEPTIONISTの来客管理を行います'
サブコマンド: visitors(来客一覧) / visitor(詳細 id string required) / notify(来客通知 host_name/visitor_name/company string required)
vaultService から 'receptionist_api_token' 取得。未設定ガイド color: 0x00B4D8

---
=== TASK 2: freee HR（人事労務）連携 ===

【src/integrations/freeehr.ts を新規作成】

freee HR API (https://developer.freee.co.jp/docs/hr) を使用。
認証: Bearer token
Base URL: https://api.freee.co.jp/hr/api/v1

export async function getEmployees(token: string, companyId: number): Promise<Array<{ id: number; display_name: string; entry_date: string; department: string; }>>
  GET https://api.freee.co.jp/hr/api/v1/employees?company_id={companyId}
  レスポンス: { employees: [{ id, display_name, entry_date, department: { name } }] }
  -> { id, display_name, entry_date, department: department.name || '' } の配列

export async function getPayrolls(token: string, companyId: number, year: number, month: number): Promise<Array<{ employee_id: number; employee_name: string; total_amount: number; }>>
  GET https://api.freee.co.jp/hr/api/v1/salaries/employee_payroll_statements?company_id={companyId}&year={year}&month={month}
  レスポンス: { employee_payroll_statements: [{ employee_id, employee_display_name, total_amount }] }
  -> { employee_id, employee_name: employee_display_name, total_amount } の配列

export async function getWorkRecords(token: string, companyId: number, employeeId: number, year: number, month: number): Promise<{ total_work_mins: number; total_overtime_work_mins: number; }>
  GET https://api.freee.co.jp/hr/api/v1/employees/{employeeId}/work_record_summaries/{year}/{month}?company_id={companyId}
  レスポンス: { total_work_mins, total_overtime_work_mins }

全関数: import { IntegrationError } from './errors'

【src/commands/freeehr.ts を新規作成】
コマンド名: 'freeehr', description: 'freee人事労務の従業員・給与・勤怠を管理します'
サブコマンド: employees(company_id integer required) / payrolls(company_id/year/month integer) / workrecords(company_id/employee_id/year/month integer)
vaultService から 'freeehr_access_token' 取得。未設定ガイド color: 0x00C4A7

---
=== TASK 3: Money Forward クラウド給与連携 ===

【src/integrations/mfpayroll.ts を新規作成】

Money Forward クラウド給与 API を使用。
認証: Bearer token
Base URL: https://payroll.moneyforward.com/api/v1

export async function getEmployees(token: string): Promise<Array<{ id: string; display_name: string; department_name: string; employment_type: string; }>>
  GET https://payroll.moneyforward.com/api/v1/employees
  ヘッダー: Authorization: Bearer {token}
  レスポンス: { data: [{ id, display_name, department: { name }, employment_type }] }
  -> { id, display_name, department_name: department.name || '', employment_type } の配列

export async function getPayslips(token: string, year: number, month: number): Promise<Array<{ employee_id: string; employee_name: string; net_amount: number; }>>
  GET https://payroll.moneyforward.com/api/v1/payslips?year={year}&month={month}
  レスポンス: { data: [{ employee_id, employee_display_name, net_amount }] }
  -> { employee_id, employee_name: employee_display_name, net_amount } の配列

全関数: import { IntegrationError } from './errors'

【src/commands/mfpayroll.ts を新規作成】
コマンド名: 'mfpayroll', description: 'Money Forwardクラウド給与の従業員・給与明細を確認します'
サブコマンド: employees / payslips(year integer optional, month integer optional)
vaultService から 'mfpayroll_access_token' 取得。未設定ガイド color: 0x003087

---
=== TASK 4: commandHandler.ts への登録 ===
import { receptionistCommand } from '../commands/receptionist';
import { freeehrCommand } from '../commands/freeehr';
import { mfpayrollCommand } from '../commands/mfpayroll';
commands配列に追加。

注意: npm installは不要。TypeScript型エラーなし。git commitは不要。
