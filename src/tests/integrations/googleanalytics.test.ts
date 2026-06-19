import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as googleanalytics from '../../integrations/googleanalytics';

describe('googleanalytics', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('runs report on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ rows: [{ dimensionValues: [{ value: '/home' }], metricValues: [{ value: '12' }] }] }));

    await expect(googleanalytics.getPageViews('token', 'property')).resolves.toEqual([
      { pagePath: '/home', screenPageViews: '12' },
    ]);
  });

  it('throws when property id is empty', async () => {
    await expect(googleanalytics.runReport('token', ' ', ['sessions'], ['pagePath'])).rejects.toThrow(IntegrationError);
  });

  it('throws when metrics are empty', async () => {
    await expect(googleanalytics.runReport('token', 'property', [], ['pagePath'])).rejects.toThrow(IntegrationError);
  });
});
