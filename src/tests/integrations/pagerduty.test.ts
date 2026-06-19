import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as pagerduty from '../../integrations/pagerduty';

describe('pagerduty', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists incidents on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        incidents: [
          {
            id: 'inc-1',
            title: 'Database alert',
            status: 'triggered',
            urgency: 'high',
            created_at: '2026-06-20T00:00:00Z',
            html_url: 'https://example.com/incidents/inc-1',
            service: { summary: 'API' },
          },
        ],
      })
    );

    await expect(pagerduty.listIncidents('api-key')).resolves.toEqual([
      {
        id: 'inc-1',
        title: 'Database alert',
        status: 'triggered',
        urgency: 'high',
        service: 'API',
        created_at: '2026-06-20T00:00:00Z',
        html_url: 'https://example.com/incidents/inc-1',
      },
    ]);
  });

  it('throws when api key missing', async () => {
    await expect(pagerduty.listServices(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when incident id missing', async () => {
    await expect(pagerduty.getIncident('api-key', ' ')).rejects.toThrow(IntegrationError);
  });
});
