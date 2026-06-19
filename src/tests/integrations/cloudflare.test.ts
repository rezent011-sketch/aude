import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as cloudflare from '../../integrations/cloudflare';

describe('cloudflare', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists zones on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        result: [{ id: 'zone-1', name: 'example.com', status: 'active', plan: { name: 'free' } }],
      })
    );

    await expect(cloudflare.getZones('token')).resolves.toEqual([
      { id: 'zone-1', name: 'example.com', status: 'active', plan: 'free' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(cloudflare.getZones(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when zone id is empty', async () => {
    await expect(cloudflare.purgeCache('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
