jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as gmail from '../../integrations/gmail';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('gmail', () => {
  const originalEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  };

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.GOOGLE_CLIENT_ID = 'client';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'refresh';
  });

  afterAll(() => {
    process.env.GOOGLE_CLIENT_ID = originalEnv.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = originalEnv.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_REFRESH_TOKEN = originalEnv.GOOGLE_REFRESH_TOKEN;
  });

  it('searches gmail messages on success', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ access_token: 'access' } as never)
      .mockResolvedValueOnce({ messages: [{ id: 'm1', threadId: 't1' }] } as never)
      .mockResolvedValueOnce({ access_token: 'access' } as never)
      .mockResolvedValueOnce({
        id: 'm1',
        threadId: 't1',
        snippet: 'hello',
        internalDate: '1710000000000',
        payload: { headers: [{ name: 'Subject', value: 'Hello' }, { name: 'From', value: 'alice@example.com' }] },
      } as never);

    await expect(gmail.searchGmailMessages('label:inbox')).resolves.toEqual([
      expect.objectContaining({ id: 'm1', threadId: 't1', subject: 'Hello', from: 'alice@example.com', snippet: 'hello' }),
    ]);
  });

  it('throws when search query is empty', async () => {
    await expect(gmail.searchGmailMessages(' ')).rejects.toThrow(IntegrationError);
  });

  it('sends gmail message on success', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ access_token: 'access' } as never)
      .mockResolvedValueOnce({ id: 'sent1', threadId: 'thread1', labelIds: ['SENT'] } as never);

    await expect(gmail.sendGmailMessage('bob@example.com', 'Subject', 'Body')).resolves.toEqual({
      id: 'sent1',
      threadId: 'thread1',
      labelIds: ['SENT'],
    });
  });
});
