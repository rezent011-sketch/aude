jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as hubspotcrm from '../../integrations/hubspotcrm';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('hubspotcrm', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('gets contacts on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ results: [{ id: '1', properties: { email: 'a@example.com', firstname: 'A', lastname: 'B', company: 'ACME' } }] } as never);

    await expect(hubspotcrm.getContacts('token')).resolves.toEqual([
      { id: '1', email: 'a@example.com', firstName: 'A', lastName: 'B', company: 'ACME' },
    ]);
  });

  it('throws when token is empty', async () => {
    await expect(hubspotcrm.getContacts(' ')).rejects.toThrow(IntegrationError);
  });

  it('creates contact on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ id: 'c1' } as never);

    await expect(hubspotcrm.createContact('token', 'a@example.com', 'A', 'B')).resolves.toEqual({ id: 'c1' });
  });
});
