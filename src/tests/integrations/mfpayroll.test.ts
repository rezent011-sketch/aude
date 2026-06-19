import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as mfpayroll from '../../integrations/mfpayroll';

describe('mfpayroll', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets employees on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: [{ id: 'e1', display_name: 'Alice', department: { name: 'HR' }, employment_type: 'full_time' }] }));

    await expect(mfpayroll.getEmployees('token')).resolves.toEqual([
      { id: 'e1', display_name: 'Alice', department_name: 'HR', employment_type: 'full_time' },
    ]);
  });

  it('throws when year is invalid', async () => {
    await expect(mfpayroll.getPayslips('token', 0, 6)).rejects.toThrow(IntegrationError);
  });

  it('gets payslips on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: [{ employee_id: 'e1', employee_display_name: 'Alice', net_amount: 1000 }] }));
    await expect(mfpayroll.getPayslips('token', 2026, 6)).resolves.toEqual([
      { employee_id: 'e1', employee_name: 'Alice', net_amount: 1000 },
    ]);
  });
});
