import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as metaads from '../../integrations/metaads';

describe('metaads', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets ad accounts on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: [{ id: 'act_1', name: 'Main', currency: 'JPY', account_status: 1 }] }));

    await expect(metaads.getAdAccounts('token')).resolves.toEqual([
      { id: 'act_1', name: 'Main', currency: 'JPY', account_status: 1 },
    ]);
  });

  it('throws when account id is empty', async () => {
    await expect(metaads.getCampaigns('token', ' ')).rejects.toThrow(IntegrationError);
  });

  it('gets campaign insights on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: [{ impressions: '100', clicks: '5', spend: '12.34', ctr: '5.0' }] }));
    await expect(metaads.getCampaignInsights('token', 'cmp1')).resolves.toEqual({ impressions: '100', clicks: '5', spend: '12.34', ctr: '5.0' });
  });
});
