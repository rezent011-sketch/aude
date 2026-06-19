import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as vonage from '../../integrations/vonage';

describe('vonage', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets balance on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        value: 42.5,
        auto_reload: true,
      })
    );

    await expect(vonage.getBalance('api-key', 'api-secret')).resolves.toEqual({
      value: 42.5,
      autoReload: true,
    });
  });

  it('throws when api key missing', async () => {
    await expect(vonage.getBalance(' ', 'api-secret')).rejects.toThrow(IntegrationError);
  });

  it('throws when recipient missing', async () => {
    await expect(vonage.sendSms('api-key', 'api-secret', 'Aude', ' ', 'hello')).rejects.toThrow(
      IntegrationError
    );
  });
});
