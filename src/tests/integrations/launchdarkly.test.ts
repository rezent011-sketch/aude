import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as launchdarkly from '../../integrations/launchdarkly';

describe('launchdarkly', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets projects on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ items: [{ key: 'proj', name: 'Project' }] }));

    await expect(launchdarkly.getProjects('token')).resolves.toEqual([{ key: 'proj', name: 'Project' }]);
  });

  it('throws when project or flag key is empty', async () => {
    await expect(launchdarkly.toggleFlag('token', ' ', 'flag', true)).rejects.toThrow(IntegrationError);
  });

  it('toggles flag on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({}));
    await expect(launchdarkly.toggleFlag('token', 'proj', 'flag', true)).resolves.toBeUndefined();
  });
});
