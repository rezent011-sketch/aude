import { createJsonResponse, createTextResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as chatwork from '../../integrations/chatwork';

describe('chatwork', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets current user on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ account_id: 1, name: 'User', mail: 'user@example.com' })
    );

    await expect(chatwork.getMe('key')).resolves.toEqual({
      account_id: 1,
      name: 'User',
      email: 'user@example.com',
    });
  });

  it('throws when api key is missing', async () => {
    await expect(chatwork.getMe(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when the API returns an error', async () => {
    fetchMock.mockResolvedValueOnce(createTextResponse('bad request', false, 400));
    await expect(chatwork.sendMessage('key', 1, 'hello')).rejects.toThrow(IntegrationError);
  });
});
