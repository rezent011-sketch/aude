import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as sansan from '../../integrations/sansan';

describe('sansan', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets contacts on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          {
            bizCardId: 'card-1',
            name: { lastName: 'User', firstName: 'Alice' },
            company: { name: 'Acme' },
            email: 'alice@example.com',
          },
        ],
      })
    );

    await expect(sansan.getContacts('token')).resolves.toEqual([
      {
        id: 'card-1',
        name: 'User Alice',
        company: 'Acme',
        email: 'alice@example.com',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(sansan.getContacts(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when card id missing', async () => {
    await expect(sansan.getContact('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
