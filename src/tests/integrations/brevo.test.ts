import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as brevo from '../../integrations/brevo';

describe('brevo', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists contacts on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        contacts: [{ id: 1, email: 'a@example.com', attributes: { FIRSTNAME: 'A', LASTNAME: 'User' } }],
      })
    );

    await expect(brevo.getContacts('key')).resolves.toEqual([
      { id: 1, email: 'a@example.com', firstName: 'A', lastName: 'User' },
    ]);
  });

  it('throws when api key is missing', async () => {
    await expect(brevo.getContacts(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when recipient is empty', async () => {
    await expect(brevo.sendTransactionalEmail('key', ' ', 'subject', '<p>x</p>', 'from@example.com')).rejects.toThrow(
      IntegrationError
    );
  });
});
