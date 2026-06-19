import { createJsonResponse, createTextResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as line from '../../integrations/line';

describe('line', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('pushes message on success', async () => {
    fetchMock.mockResolvedValueOnce(createTextResponse('', true, 204));
    await expect(line.pushMessage('token', 'user1', 'hello')).resolves.toBeUndefined();
  });

  it('gets profile on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ displayName: 'Alice', pictureUrl: 'https://example.com/a.png', statusMessage: 'hi' }));
    await expect(line.getProfile('token', 'user1')).resolves.toEqual({ displayName: 'Alice', pictureUrl: 'https://example.com/a.png', statusMessage: 'hi' });
  });

  it('throws when line api returns error', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ message: 'bad request' }, false, 400));
    await expect(line.broadcastMessage('token', 'hello')).rejects.toThrow(IntegrationError);
  });
});
