import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as salesforce from '../../integrations/salesforce';

describe('salesforce', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets accounts on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        records: [
          {
            Id: '001',
            Name: 'Acme',
            Industry: 'Software',
            AnnualRevenue: 1000000,
          },
        ],
      })
    );

    await expect(salesforce.getAccounts('token', 'demo')).resolves.toEqual([
      {
        Id: '001',
        Name: 'Acme',
        Industry: 'Software',
        AnnualRevenue: 1000000,
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(salesforce.getAccounts(' ', 'demo')).rejects.toThrow(IntegrationError);
  });

  it('throws when instance missing', async () => {
    await expect(salesforce.getAccounts('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
