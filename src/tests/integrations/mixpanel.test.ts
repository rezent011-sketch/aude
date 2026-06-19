import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as mixpanel from '../../integrations/mixpanel';

describe('mixpanel', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets top events on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: { series: { Signup: { '2026-06-20': 3 } } } }));

    await expect(mixpanel.getTopEvents('svc', 'secret', 'project1')).resolves.toEqual([
      { event: 'Signup', count: 3 },
    ]);
  });

  it('throws when project id is empty', async () => {
    await expect(mixpanel.getTopEvents('svc', 'secret', ' ')).rejects.toThrow(IntegrationError);
  });

  it('gets funnels on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse([{ funnel_id: 1, name: 'Signup funnel' }]));
    await expect(mixpanel.getFunnels('svc', 'secret', 'project1')).resolves.toEqual([{ funnel_id: 1, name: 'Signup funnel' }]);
  });
});
