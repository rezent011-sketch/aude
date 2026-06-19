import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as calendly from '../../integrations/calendly';

describe('calendly', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets the current user on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ resource: { uri: 'user://1', name: 'User', email: '', scheduling_url: '' } })
    );

    await expect(calendly.getCurrentUser('token')).resolves.toEqual({
      uri: 'user://1',
      name: 'User',
      email: '',
      scheduling_url: '',
    });
  });

  it('throws when token is missing', async () => {
    await expect(calendly.getCurrentUser(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when user uri is empty', async () => {
    await expect(calendly.getEventTypes('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
