import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as stores from '../../integrations/stores';

describe('stores', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets shop on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        shop: {
          id: 'shop-1',
          name: 'Acme Store',
          url: 'https://acme.stores.jp',
        },
      })
    );

    await expect(stores.getShop('token')).resolves.toEqual({
      id: 'shop-1',
      name: 'Acme Store',
      url: 'https://acme.stores.jp',
    });
  });

  it('throws when token missing', async () => {
    await expect(stores.getShop(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when page invalid', async () => {
    await expect(stores.getProducts('token', 0)).rejects.toThrow(IntegrationError);
  });
});
