jest.mock('jira.js', () => ({ Version3Client: jest.fn() }));

import { IntegrationError } from '../../integrations/errors';
import * as jira from '../../integrations/jira';

describe('jira', () => {
  it('creates jira client with valid credentials', () => {
    const client = jira.getJiraClient('example.atlassian.net', 'a@example.com', 'token');
    expect(client).toBeDefined();
  });

  it('throws when host is empty', () => {
    expect(() => jira.getJiraClient(' ', 'a@example.com', 'token')).toThrow(IntegrationError);
  });

  it('lists projects on success', async () => {
    const client = {
      projects: {
        searchProjects: jest.fn().mockResolvedValueOnce({ isLast: true, values: [{ id: '1', key: 'PRJ', name: 'Project' }] }),
      },
    } as any;

    await expect(jira.listProjects(client)).resolves.toEqual([{ id: '1', key: 'PRJ', name: 'Project' }]);
  });
});
