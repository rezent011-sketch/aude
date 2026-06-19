import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as copper from '../../integrations/copper';

describe('copper', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('searches people on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([{ id: 1, name: 'Alice', emails: [{ email: 'a@example.com' }], company_name: 'ACME' }])
    );

    await expect(copper.searchPeople('token', 'alice', 'user@example.com')).resolves.toEqual([
      { id: 1, name: 'Alice', email: 'a@example.com', company_name: 'ACME' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(copper.getOpportunities(' ', 'user@example.com')).rejects.toThrow(IntegrationError);
  });

  it('throws when contact email is empty', async () => {
    await expect(copper.createPerson('token', 'user@example.com', 'Alice', ' ')).rejects.toThrow(IntegrationError);
  });
});
