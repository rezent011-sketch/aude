import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as sentry from '../../integrations/sentry';

describe('sentry', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets organizations on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([{ id: 'org-1', slug: 'acme', name: 'Acme Inc.' }])
    );

    await expect(sentry.getOrganizations('token')).resolves.toEqual([
      {
        id: 'org-1',
        slug: 'acme',
        name: 'Acme Inc.',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(sentry.getOrganizations(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when org slug missing', async () => {
    await expect(sentry.getProjects('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
