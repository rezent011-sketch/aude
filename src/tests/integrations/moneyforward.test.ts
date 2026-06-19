import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as moneyforward from '../../integrations/moneyforward';

describe('moneyforward', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets offices on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: [{ office: { id: 'o1', name: 'Tokyo' } }] }));

    await expect(moneyforward.getOffices('token')).resolves.toEqual([{ id: 'o1', name: 'Tokyo' }]);
  });

  it('throws when office id is empty for expenses', async () => {
    await expect(moneyforward.getExpenses('token', ' ')).rejects.toThrow(IntegrationError);
  });

  it('gets expenses on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: [{ expense_application: { id: 'e1', title: 'Taxi', amount: 1200, status: 'approved' } }] }));
    await expect(moneyforward.getExpenses('token', 'o1')).resolves.toEqual([{ id: 'e1', subject: 'Taxi', amount: 1200, status: 'approved' }]);
  });
});
