import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as datadog from '../../integrations/datadog';

describe('datadog', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists alerts on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([{ id: 11, name: 'CPU', overall_state: 'Alert', priority: 1, message: 'High CPU' }])
    );

    await expect(datadog.listAlerts('api', 'app')).resolves.toEqual([
      {
        id: 11,
        name: 'CPU',
        status: 'Alert',
        priority: '1',
        message: 'High CPU',
        url: 'https://app.datadoghq.com/monitors/11',
      },
    ]);
  });

  it('throws when keys are missing', async () => {
    await expect(datadog.listAlerts(' ', 'app')).rejects.toThrow(IntegrationError);
  });

  it('throws when query is empty', async () => {
    await expect(datadog.getMetrics('api', 'app', ' ')).rejects.toThrow(IntegrationError);
  });
});
