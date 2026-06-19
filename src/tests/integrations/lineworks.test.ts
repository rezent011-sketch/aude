import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as lineworks from '../../integrations/lineworks';

describe('lineworks', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets channels on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([{ channelId: 'c1', channelName: 'General', type: 'group' }]));

    await expect(lineworks.getChannels('token', 'bot1')).resolves.toEqual([
      { channelId: 'c1', channelName: 'General', type: 'group' },
    ]);
  });

  it('throws when channel id is empty', async () => {
    await expect(lineworks.sendMessage('token', 'bot1', ' ', 'hello')).rejects.toThrow(IntegrationError);
  });

  it('gets messages on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([{ messageId: 'm1', content: { type: 'text', text: 'hello' }, createdTime: '2026-06-20T00:00:00Z' }]));
    await expect(lineworks.getMessages('token', 'bot1', 'c1')).resolves.toEqual([
      { messageId: 'm1', text: 'hello', createdTime: '2026-06-20T00:00:00Z' },
    ]);
  });
});
