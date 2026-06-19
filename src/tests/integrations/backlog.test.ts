import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as backlog from '../../integrations/backlog';

describe('backlog', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists projects on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([{ id: 1, projectKey: 'PRJ', name: 'Project', archived: false }])
    );

    await expect(backlog.listProjects('api-key', 'demo')).resolves.toEqual([
      { id: 1, projectKey: 'PRJ', name: 'Project', archived: false },
    ]);
  });

  it('throws when api key is missing', async () => {
    await expect(backlog.listProjects(' ', 'demo')).rejects.toThrow(IntegrationError);
  });

  it('throws when space is empty', async () => {
    await expect(backlog.listProjects('api-key', ' ')).rejects.toThrow(IntegrationError);
  });
});
