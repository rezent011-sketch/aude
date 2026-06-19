import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as intercom from '../../integrations/intercom';

describe('intercom', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets conversations on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ conversations: [{ id: '1', source: { subject: 'Need help' }, state: 'open', created_at: 1710000000, assignee: { name: 'Agent' } }] }));

    await expect(intercom.getConversations('token')).resolves.toEqual([
      { id: '1', subject: 'Need help', state: 'open', created_at: 1710000000, assignee_name: 'Agent' },
    ]);
  });

  it('throws when conversation id is empty', async () => {
    await expect(intercom.sendMessage('token', ' ', 'hello')).rejects.toThrow(IntegrationError);
  });

  it('throws when send message body is empty', async () => {
    await expect(intercom.sendMessage('token', '1', ' ')).rejects.toThrow(IntegrationError);
  });
});
