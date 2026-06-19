import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as webflow from '../../integrations/webflow';

describe('webflow', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets sites on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        sites: [
          {
            id: 'site-1',
            displayName: 'Marketing Site',
            shortName: 'marketing',
            lastPublished: '2026-06-20T00:00:00Z',
          },
        ],
      })
    );

    await expect(webflow.getSites('token')).resolves.toEqual([
      {
        id: 'site-1',
        displayName: 'Marketing Site',
        shortName: 'marketing',
        lastPublished: '2026-06-20T00:00:00Z',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(webflow.getSites(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when site id missing', async () => {
    await expect(webflow.getCollections('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
