jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as vercel from '../../integrations/vercel';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('vercel', () => {
  const originalToken = process.env.VERCEL_TOKEN;

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.VERCEL_TOKEN = 'vercel-token';
  });

  afterAll(() => {
    process.env.VERCEL_TOKEN = originalToken;
  });

  it('lists deployments on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      deployments: [
        {
          uid: 'dep_1',
          name: 'web',
          url: 'web.vercel.app',
          state: 'READY',
          createdAt: 1710000000000,
          inspectorUrl: 'https://vercel.example.com/dep_1',
          meta: { githubCommitRef: 'main' },
        },
      ],
    } as never);

    await expect(vercel.listVercelDeployments()).resolves.toEqual([
      {
        id: 'dep_1',
        name: 'web',
        url: 'https://web.vercel.app',
        state: 'READY',
        branch: 'main',
        createdAt: '2024-03-09T16:00:00.000Z',
        inspectorUrl: 'https://vercel.example.com/dep_1',
      },
    ]);
  });

  it('throws when token missing', async () => {
    delete process.env.VERCEL_TOKEN;
    await expect(vercel.listVercelProjects()).rejects.toThrow(IntegrationError);
  });

  it('throws when deployment id missing', async () => {
    await expect(vercel.getVercelDeploymentStatus(' ')).rejects.toThrow(IntegrationError);
  });
});
