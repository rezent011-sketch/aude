import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as kingofthyme from '../../integrations/kingofthyme';

describe('kingofthyme', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets employees on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ employees: [{ employee_id: 'e1', name: 'Alice', group_name: 'Sales' }] }));

    await expect(kingofthyme.getEmployees('token')).resolves.toEqual([{ employee_id: 'e1', name: 'Alice', group_name: 'Sales' }]);
  });

  it('throws when employee id is empty', async () => {
    await expect(kingofthyme.getMonthlyAttendance('token', ' ', 2026, 6)).rejects.toThrow(IntegrationError);
  });

  it('throws when month is out of range', async () => {
    await expect(kingofthyme.getMonthlyAttendance('token', 'e1', 2026, 13)).rejects.toThrow(IntegrationError);
  });
});
