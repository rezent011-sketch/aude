import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as clickup from '../../integrations/clickup';

describe('clickup', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists spaces on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ spaces: [{ id: 's1', name: 'Main Space' }] }));

    await expect(clickup.getSpaces('token', 'team-1')).resolves.toEqual([{ id: 's1', name: 'Main Space' }]);
  });

  it('throws when token is missing', async () => {
    await expect(clickup.getSpaces(' ', 'team-1')).rejects.toThrow(IntegrationError);
  });

  it('throws when task name is empty', async () => {
    await expect(clickup.createTask('token', 'list-1', ' ')).rejects.toThrow(IntegrationError);
  });
});
