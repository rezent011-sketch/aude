jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { createTextResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as githubactions from '../../integrations/githubactions';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('githubactions', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchMock.mockReset();
  });

  it('lists workflows on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ workflows: [{ id: 1, name: 'CI', state: 'active', path: '.github/workflows/ci.yml' }] } as never);

    await expect(githubactions.listWorkflows('token', 'owner', 'repo')).resolves.toEqual([
      { id: 1, name: 'CI', state: 'active', path: '.github/workflows/ci.yml' },
    ]);
  });

  it('throws when workflow id is empty', async () => {
    await expect(githubactions.triggerWorkflow('token', 'owner', 'repo', ' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when workflow trigger returns non-204', async () => {
    fetchMock.mockResolvedValueOnce(createTextResponse('bad request', false, 400));
    await expect(githubactions.triggerWorkflow('token', 'owner', 'repo', 1)).rejects.toThrow(IntegrationError);
  });
});
