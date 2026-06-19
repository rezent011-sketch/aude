import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as square from '../../integrations/square';

describe('square', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists locations on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        locations: [
          {
            id: 'loc-1',
            name: 'Tokyo Store',
            address: { address_line_1: '1-2-3 Shibuya' },
          },
        ],
      })
    );

    await expect(square.listLocations('token')).resolves.toEqual([
      {
        id: 'loc-1',
        name: 'Tokyo Store',
        address: '1-2-3 Shibuya',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(square.listLocations(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when location id missing', async () => {
    await expect(square.listTransactions('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
