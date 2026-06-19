import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as zoom from '../../integrations/zoom';

describe('zoom', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets access token on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ access_token: 'zoom-access-token' }));
    await expect(zoom.getAccessToken('account-id', 'client-id', 'client-secret')).resolves.toBe(
      'zoom-access-token'
    );
  });

  it('throws when account id missing', async () => {
    await expect(zoom.getAccessToken(' ', 'client-id', 'client-secret')).rejects.toThrow(
      IntegrationError
    );
  });

  it('throws when oauth response missing token', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ reason: 'invalid_client' }, false, 401));
    await expect(zoom.getAccessToken('account-id', 'client-id', 'client-secret')).rejects.toThrow(
      IntegrationError
    );
  });
});
