import { createTextResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as zapier from '../../integrations/zapier';

describe('zapier', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('triggers zap on success', async () => {
    fetchMock.mockResolvedValueOnce(createTextResponse('', true, 200));
    await expect(zapier.triggerZap('https://hooks.zapier.com/test', { hello: 'world' })).resolves.toEqual({
      status: 'triggered',
    });
  });

  it('throws when webhook url missing', async () => {
    await expect(zapier.triggerZap(' ', {})).rejects.toThrow(IntegrationError);
  });

  it('throws when webhook returns error', async () => {
    fetchMock.mockResolvedValueOnce(createTextResponse('bad request', false, 400));
    await expect(zapier.testWebhook('https://hooks.zapier.com/test')).rejects.toThrow(IntegrationError);
  });
});
