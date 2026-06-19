import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as talentio from '../../integrations/talentio';

describe('talentio', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets jobs on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        jobs: [{ id: 1, name: 'Backend Engineer', status: 'open' }],
      })
    );

    await expect(talentio.getJobs('token')).resolves.toEqual([
      {
        id: 1,
        name: 'Backend Engineer',
        status: 'open',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(talentio.getJobs(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when candidate id invalid', async () => {
    await expect(talentio.getCandidate('token', 0)).rejects.toThrow(IntegrationError);
  });
});
