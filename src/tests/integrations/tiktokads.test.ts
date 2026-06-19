import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as tiktokads from '../../integrations/tiktokads';

describe('tiktokads', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets advertisers on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          list: [
            {
              advertiser_id: 'adv-1',
              advertiser_name: 'Acme Ads',
              account_type: 'active',
            },
          ],
        },
      })
    );

    await expect(tiktokads.getAdvertisers('token')).resolves.toEqual([
      {
        advertiser_id: 'adv-1',
        advertiser_name: 'Acme Ads',
        status: 'active',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(tiktokads.getAdvertisers(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when advertiser id missing', async () => {
    await expect(tiktokads.getCampaigns('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
