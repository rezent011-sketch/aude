jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as github from '../../integrations/github';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('github', () => {
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.GITHUB_TOKEN = 'token';
  });

  afterAll(() => {
    process.env.GITHUB_TOKEN = originalToken;
  });

  it('lists repository issues on success', async () => {
    fetchJsonMock.mockResolvedValueOnce([
      { number: 1, title: 'Bug', html_url: 'https://example.com/1', state: 'open', user: { login: 'alice' } },
      { number: 2, title: 'PR', html_url: 'https://example.com/2', state: 'open', user: { login: 'bob' }, pull_request: {} },
    ] as never);

    await expect(github.listRepositoryIssues('owner/repo')).resolves.toEqual([
      { number: 1, title: 'Bug', url: 'https://example.com/1', state: 'open', author: 'alice' },
    ]);
  });

  it('throws when repository format is invalid', async () => {
    await expect(github.listRepositoryIssues('owner-only')).rejects.toThrow(IntegrationError);
  });

  it('creates repository issue on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ number: 3, title: 'Task', html_url: 'https://example.com/3' } as never);

    await expect(github.createRepositoryIssue('owner/repo', 'Task', 'Body')).resolves.toEqual({
      number: 3,
      title: 'Task',
      url: 'https://example.com/3',
    });
  });
});
