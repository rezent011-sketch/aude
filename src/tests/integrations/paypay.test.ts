import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as paypay from '../../integrations/paypay';

describe('paypay', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('creates payment on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          url: 'https://paypay.example.com/pay',
          merchantPaymentId: 'mp-1',
        },
      })
    );

    await expect(paypay.createPayment('key', 'secret', 'mp-1', 1200, 'Order')).resolves.toEqual({
      paymentUrl: 'https://paypay.example.com/pay',
      merchantPaymentId: 'mp-1',
    });
  });

  it('throws when api key missing', async () => {
    await expect(paypay.getPaymentStatus(' ', 'secret', 'mp-1')).rejects.toThrow(IntegrationError);
  });

  it('throws when amount invalid', async () => {
    await expect(paypay.createPayment('key', 'secret', 'mp-1', 0, 'Order')).rejects.toThrow(
      IntegrationError
    );
  });
});
