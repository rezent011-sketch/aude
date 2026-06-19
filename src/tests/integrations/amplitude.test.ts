import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as amplitude from '../../integrations/amplitude';

describe('amplitude', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns active users on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ data: { series: [[12]], xValues: ['2026-06-01'] } })
    );

    await expect(amplitude.getActiveUsers('api', 'secret', '20260601', '20260602')).resolves.toEqual([
      { date: '2026-06-01', value: 12 },
    ]);
  });

  it('throws when api key is missing', async () => {
    await expect(amplitude.getActiveUsers(' ', 'secret', '20260601', '20260602')).rejects.toThrow(
      IntegrationError
    );
  });

  it('throws when event name is empty', async () => {
    await expect(amplitude.getEventCounts('api', 'secret', ' ', '20260601', '20260602')).rejects.toThrow(
      IntegrationError
    );
  });
});
