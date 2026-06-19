import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as stripebilling from '../../integrations/stripebilling';

describe('stripebilling', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists subscriptions on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            id: 'sub_1',
            status: 'active',
            current_period_end: 1710000000,
            customer: 'cus_1',
            plan: { amount: 1200, currency: 'jpy' },
          },
        ],
      })
    );

    await expect(stripebilling.listSubscriptions('sk_test')).resolves.toEqual([
      {
        id: 'sub_1',
        status: 'active',
        current_period_end: 1710000000,
        customer: 'cus_1',
        plan_amount: 1200,
        plan_currency: 'jpy',
      },
    ]);
  });

  it('throws when secret key missing', async () => {
    await expect(stripebilling.listSubscriptions(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when limit invalid', async () => {
    await expect(stripebilling.listInvoices('sk_test', 0)).rejects.toThrow(IntegrationError);
  });
});
