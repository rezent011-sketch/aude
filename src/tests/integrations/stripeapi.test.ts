import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as stripeapi from '../../integrations/stripeapi';

describe('stripeapi', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists customers on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            id: 'cus_1',
            name: 'Alice',
            email: 'alice@example.com',
            created: 1710000000,
          },
        ],
      })
    );

    await expect(stripeapi.listCustomers('sk_test')).resolves.toEqual([
      {
        id: 'cus_1',
        name: 'Alice',
        email: 'alice@example.com',
        created: 1710000000,
      },
    ]);
  });

  it('throws when secret key missing', async () => {
    await expect(stripeapi.listCustomers(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when price id missing', async () => {
    await expect(stripeapi.createPaymentLink('sk_test', ' ')).rejects.toThrow(IntegrationError);
  });
});
