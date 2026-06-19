import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as asana from '../../integrations/asana';

describe('asana', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists workspaces on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: [{ gid: 'w1', name: 'Workspace' }] }));

    await expect(asana.getWorkspaces('token')).resolves.toEqual([{ gid: 'w1', name: 'Workspace' }]);
  });

  it('throws when token is missing', async () => {
    await expect(asana.getWorkspaces(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when task id is empty', async () => {
    await expect(asana.completeTask('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
