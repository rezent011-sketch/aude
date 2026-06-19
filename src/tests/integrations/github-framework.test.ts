jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import * as github from '../../integrations/github';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('github framework', () => {
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.GITHUB_TOKEN = 'token';
  });

  afterAll(() => {
    process.env.GITHUB_TOKEN = originalToken;
  });

  it('creates a pull request', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      number: 12,
      title: 'Add integrations',
      html_url: 'https://github.com/owner/repo/pull/12',
      state: 'open',
      head: { ref: 'feature/integrations' },
      base: { ref: 'main' },
    } as never);

    await expect(
      github.createPullRequest('owner/repo', {
        title: 'Add integrations',
        head: 'feature/integrations',
        base: 'main',
        body: 'Implements external tool framework.',
      })
    ).resolves.toEqual({
      number: 12,
      title: 'Add integrations',
      url: 'https://github.com/owner/repo/pull/12',
      state: 'open',
      head: 'feature/integrations',
      base: 'main',
    });
  });

  it('lists repository issues with custom state', async () => {
    fetchJsonMock.mockResolvedValueOnce([
      {
        number: 8,
        title: 'Backlog item',
        html_url: 'https://github.com/owner/repo/issues/8',
        state: 'closed',
        user: { login: 'alice' },
      },
    ] as never);

    await expect(
      github.listRepositoryIssues('owner/repo', { state: 'closed', perPage: 5 })
    ).resolves.toEqual([
      {
        number: 8,
        title: 'Backlog item',
        url: 'https://github.com/owner/repo/issues/8',
        state: 'closed',
        author: 'alice',
      },
    ]);
  });
});
