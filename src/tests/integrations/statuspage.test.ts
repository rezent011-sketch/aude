import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as statuspage from '../../integrations/statuspage';

describe('statuspage', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets pages on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([
        {
          id: 'page-1',
          name: 'Main Status',
          subdomain: 'acme',
          page_description: 'Primary status page',
        },
      ])
    );

    await expect(statuspage.getPages('token')).resolves.toEqual([
      {
        id: 'page-1',
        name: 'Main Status',
        subdomain: 'acme',
        page_description: 'Primary status page',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(statuspage.getPages(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when page id missing', async () => {
    await expect(statuspage.getIncidents('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
