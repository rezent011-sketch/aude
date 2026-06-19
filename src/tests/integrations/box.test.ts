import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as box from '../../integrations/box';

describe('box', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists files on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ entries: [{ id: '1', name: 'Doc', type: 'file' }] })
    );

    await expect(box.listFiles('token')).resolves.toEqual([
      { id: '1', name: 'Doc', type: 'file', size: 0, modified_at: '' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(box.listFiles(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when query is empty', async () => {
    await expect(box.searchFiles('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
