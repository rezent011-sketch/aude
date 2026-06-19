import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as circleci from '../../integrations/circleci';

describe('circleci', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists pipelines on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        items: [{ id: 'pipe-1', number: 12, state: 'created', created_at: '2026-06-20T00:00:00Z' }],
      })
    );

    await expect(circleci.getPipelines('token', 'gh/org/repo')).resolves.toEqual([
      { id: 'pipe-1', number: 12, state: 'created', created_at: '2026-06-20T00:00:00Z' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(circleci.getPipelines(' ', 'gh/org/repo')).rejects.toThrow(IntegrationError);
  });

  it('throws when pipeline id is empty', async () => {
    await expect(circleci.getWorkflows('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
