import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as segment from '../../integrations/segment';

describe('segment', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets sources on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          sources: [
            {
              id: 'src-1',
              name: 'Website',
              slug: 'website',
              enabled: true,
            },
          ],
        },
      })
    );

    await expect(segment.getSources('token')).resolves.toEqual([
      {
        id: 'src-1',
        name: 'Website',
        slug: 'website',
        enabled: true,
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(segment.getSources(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when api returns error', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ error: 'bad request' }, false, 400));
    await expect(segment.getDestinations('token')).rejects.toThrow(IntegrationError);
  });
});
