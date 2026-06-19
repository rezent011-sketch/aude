import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as shopify from '../../integrations/shopify';

describe('shopify', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets orders on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        orders: [
          {
            id: 1,
            order_number: 1001,
            total_price: '1200',
            financial_status: 'paid',
            created_at: '2026-06-20T00:00:00Z',
            customer: {
              first_name: 'Alice',
              last_name: 'User',
            },
          },
        ],
      })
    );

    await expect(shopify.getOrders('token', 'demo-shop')).resolves.toEqual([
      {
        id: 1,
        order_number: 1001,
        total_price: '1200',
        financial_status: 'paid',
        created_at: '2026-06-20T00:00:00Z',
        customer_name: 'Alice User',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(shopify.getOrders(' ', 'demo-shop')).rejects.toThrow(IntegrationError);
  });

  it('throws when shop missing', async () => {
    await expect(shopify.getProducts('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
