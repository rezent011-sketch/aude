import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as slack from '../../integrations/slack';

describe('slack', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets channels on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        ok: true,
        channels: [{ id: 'C1', name: 'general', is_private: false }],
      })
    );

    await expect(slack.getChannels('token')).resolves.toEqual([
      {
        id: 'C1',
        name: 'general',
        is_private: false,
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(slack.getChannels(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when slack response not ok', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ ok: false, error: 'bad_request' }));
    await expect(slack.getChannels('token')).rejects.toThrow(IntegrationError);
  });
});
