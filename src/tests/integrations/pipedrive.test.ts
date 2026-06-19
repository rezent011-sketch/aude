import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as pipedrive from '../../integrations/pipedrive';

describe('pipedrive', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets deals on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            id: 1,
            title: 'Enterprise Deal',
            status: 'open',
            value: 5000,
            currency: 'JPY',
            org_name: 'Acme',
          },
        ],
      })
    );

    await expect(pipedrive.getDeals('token')).resolves.toEqual([
      {
        id: 1,
        title: 'Enterprise Deal',
        status: 'open',
        value: 5000,
        currency: 'JPY',
        org_name: 'Acme',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(pipedrive.getDeals(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when title missing', async () => {
    await expect(pipedrive.createDeal('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
