import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as monday from '../../integrations/monday';

describe('monday', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets boards on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: { boards: [{ id: '1', name: 'Roadmap', state: 'active' }] } }));

    await expect(monday.getBoards('token')).resolves.toEqual([{ id: '1', name: 'Roadmap', state: 'active' }]);
  });

  it('throws when board id is empty', async () => {
    await expect(monday.getItems('token', ' ')).rejects.toThrow(IntegrationError);
  });

  it('creates item on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: { create_item: { id: '10', name: 'Task 1' } } }));
    await expect(monday.createItem('token', '1', 'Task 1')).resolves.toEqual({ id: '10', name: 'Task 1' });
  });
});
