import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as gitlab from '../../integrations/gitlab';

describe('gitlab', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists projects on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([{ id: 1, name: 'Repo', path_with_namespace: 'group/repo', web_url: 'https://gitlab.com/group/repo', star_count: 2 }]));

    await expect(gitlab.listProjects('token')).resolves.toEqual([
      { id: 1, name: 'Repo', path: 'group/repo', url: 'https://gitlab.com/group/repo', stars: 2 },
    ]);
  });

  it('throws when token is empty', async () => {
    await expect(gitlab.listProjects(' ')).rejects.toThrow(IntegrationError);
  });

  it('creates issue on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ iid: 11, title: 'Issue', web_url: 'https://gitlab.com/group/repo/-/issues/11' }));

    await expect(gitlab.createIssue('token', '1', { title: 'Issue', description: 'desc' })).resolves.toEqual({
      id: 11,
      title: 'Issue',
      url: 'https://gitlab.com/group/repo/-/issues/11',
    });
  });
});
