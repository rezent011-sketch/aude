import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as rakumo from '../../integrations/rakumo';

describe('rakumo', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets contacts on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        contacts: [
          {
            id: 'c1',
            displayName: 'Alice User',
            email: 'alice@example.com',
            organization: 'Acme',
          },
        ],
      })
    );

    await expect(rakumo.getContacts('token')).resolves.toEqual([
      {
        id: 'c1',
        name: 'Alice User',
        email: 'alice@example.com',
        company: 'Acme',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(rakumo.getContacts(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when start missing', async () => {
    await expect(rakumo.getCalendarEvents('token', ' ', '2026-06-20T10:00:00Z')).rejects.toThrow(
      IntegrationError
    );
  });
});
