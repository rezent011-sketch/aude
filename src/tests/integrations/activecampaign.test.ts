import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as activecampaign from '../../integrations/activecampaign';

describe('activecampaign', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns contacts on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ contacts: [{ id: '1', email: 'a@example.com', firstName: 'A', lastName: 'User' }] })
    );

    await expect(activecampaign.getContacts('token', 'demo', 10)).resolves.toEqual([
      { id: '1', email: 'a@example.com', firstName: 'A', lastName: 'User' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(activecampaign.getLists(' ', 'demo')).rejects.toThrow(IntegrationError);
  });

  it('throws when email is empty', async () => {
    await expect(activecampaign.createContact('token', 'demo', ' ')).rejects.toThrow(IntegrationError);
  });
});
