import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as smarthr from '../../integrations/smarthr';

describe('smarthr', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets employees on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([{ id: 'emp-1', name: 'Alice' }]));
    await expect(smarthr.getEmployees('token', 'demo')).resolves.toEqual([{ id: 'emp-1', name: 'Alice' }]);
  });

  it('throws when token missing', async () => {
    await expect(smarthr.getEmployees(' ', 'demo')).rejects.toThrow(IntegrationError);
  });

  it('throws when response shape invalid', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ employees: [] }));
    await expect(smarthr.getEmployees('token', 'demo')).rejects.toThrow(IntegrationError);
  });
});
