import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as trello from '../../integrations/trello';

describe('trello', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets boards on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([
        {
          id: 'board-1',
          name: 'Roadmap',
          url: 'https://trello.example.com/b/1',
          closed: false,
        },
      ])
    );

    await expect(trello.getBoards('key', 'token')).resolves.toEqual([
      {
        id: 'board-1',
        name: 'Roadmap',
        url: 'https://trello.example.com/b/1',
        closed: false,
      },
    ]);
  });

  it('throws when board id missing', async () => {
    await expect(trello.getLists('key', 'token', ' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when card name missing', async () => {
    await expect(trello.createCard('key', 'token', { idList: 'list-1', name: ' ' })).rejects.toThrow(
      IntegrationError
    );
  });
});
