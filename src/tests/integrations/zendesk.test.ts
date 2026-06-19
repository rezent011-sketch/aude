import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as zendesk from '../../integrations/zendesk';

describe('zendesk', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets tickets on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        tickets: [
          {
            id: 1,
            subject: 'Login issue',
            status: 'open',
            priority: 'high',
            created_at: '2026-06-20T00:00:00Z',
            via: { source: { from: { name: 'Alice' } } },
          },
        ],
      })
    );

    await expect(zendesk.getTickets('agent@example.com', 'token', 'demo')).resolves.toEqual([
      {
        id: 1,
        subject: 'Login issue',
        status: 'open',
        priority: 'high',
        created_at: '2026-06-20T00:00:00Z',
        requester_name: 'Alice',
      },
    ]);
  });

  it('throws when subdomain missing', async () => {
    await expect(zendesk.getTickets('agent@example.com', 'token', ' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when ticket id invalid', async () => {
    await expect(zendesk.getTicket('agent@example.com', 'token', 'demo', 0)).rejects.toThrow(
      IntegrationError
    );
  });
});
