import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as jobcan from '../../integrations/jobcan';

describe('jobcan', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets staff list on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ result: 1, staffs: [{ staff_id: 1, name: 'Alice', group_name: 'Dev' }] }));

    await expect(jobcan.getStaffList('token')).resolves.toEqual([{ id: 1, name: 'Alice', group_name: 'Dev' }]);
  });

  it('throws when token is empty', async () => {
    await expect(jobcan.getStaffList(' ')).rejects.toThrow(IntegrationError);
  });

  it('clocks in on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ result: 1 }));
    await expect(jobcan.clockIn('token', 'start')).resolves.toBeUndefined();
  });
});
