jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as hubspot from '../../integrations/hubspot';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('hubspot', () => {
  const originalToken = process.env.HUBSPOT_API_KEY;

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.HUBSPOT_API_KEY = 'token';
  });

  afterAll(() => {
    process.env.HUBSPOT_API_KEY = originalToken;
  });

  it('gets hubspot contact on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ results: [{ id: '1', properties: { email: 'a@example.com', firstname: 'A', lastname: 'B', phone: '090', company: 'ACME' } }] } as never);

    await expect(hubspot.getHubSpotContact('a@example.com')).resolves.toEqual({
      id: '1',
      email: 'a@example.com',
      firstname: 'A',
      lastname: 'B',
      phone: '090',
      company: 'ACME',
    });
  });

  it('throws when contact email is empty', async () => {
    await expect(hubspot.getHubSpotContact(' ')).rejects.toThrow(IntegrationError);
  });

  it('lists deals on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ results: [{ id: 'd1', properties: { dealname: 'Deal', dealstage: 'closedwon', amount: '1000', closedate: '2026-06-20' } }] } as never);

    await expect(hubspot.listHubSpotDeals(5)).resolves.toEqual([
      { id: 'd1', name: 'Deal', stage: 'closedwon', amount: '1000', closeDate: '2026-06-20' },
    ]);
  });
});
