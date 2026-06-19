import { createTextResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as discordwebhook from '../../integrations/discordwebhook';

describe('discordwebhook', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('sends a webhook message on success', async () => {
    fetchMock.mockResolvedValueOnce(createTextResponse('', true, 204));

    await expect(discordwebhook.sendWebhookMessage('https://example.com/webhook', 'hello')).resolves.toBeUndefined();
  });

  it('throws when webhook url is missing', async () => {
    await expect(discordwebhook.sendWebhookMessage(' ', 'hello')).rejects.toThrow(IntegrationError);
  });

  it('throws when embed title is empty', async () => {
    await expect(discordwebhook.sendEmbedMessage('https://example.com/webhook', ' ', 'desc')).rejects.toThrow(
      IntegrationError
    );
  });
});
