import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as heroku from '../../integrations/heroku';

describe('heroku', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists apps on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([{ id: 'a1', name: 'app', web_url: 'https://app.herokuapp.com', stack: { name: 'heroku-24' }, region: { name: 'us' } }]));

    await expect(heroku.getApps('token')).resolves.toEqual([
      { id: 'a1', name: 'app', web_url: 'https://app.herokuapp.com', stack: 'heroku-24', region: 'us' },
    ]);
  });

  it('throws when app name is empty for dynos', async () => {
    await expect(heroku.getDynos('token', ' ')).rejects.toThrow(IntegrationError);
  });

  it('restarts dynos on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({}));
    await expect(heroku.restartDynos('token', 'app')).resolves.toBeUndefined();
  });
});
