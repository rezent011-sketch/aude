import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as miro from '../../integrations/miro';

describe('miro', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets boards on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: [{ id: 'b1', name: 'Board', description: 'desc', viewLink: 'https://miro.com/app/board/b1/' }] }));

    await expect(miro.getBoards('token')).resolves.toEqual([
      { id: 'b1', name: 'Board', description: 'desc', viewLink: 'https://miro.com/app/board/b1/' },
    ]);
  });

  it('throws when board id is empty', async () => {
    await expect(miro.getBoard('token', ' ')).rejects.toThrow(IntegrationError);
  });

  it('creates sticky note on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ id: 's1', data: { content: 'hello' } }));
    await expect(miro.createStickyNote('token', 'b1', 'hello')).resolves.toEqual({ id: 's1', content: 'hello' });
  });
});
