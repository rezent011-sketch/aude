import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as freshdesk from '../../integrations/freshdesk';

describe('freshdesk', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists tickets on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse([{ id: 1, subject: 'Help', status: 2, priority: 1, created_at: '2026-06-20' }])
    );

    await expect(freshdesk.getTickets('key', 'acme')).resolves.toEqual([
      { id: 1, subject: 'Help', status: 2, priority: 1, created_at: '2026-06-20' },
    ]);
  });

  it('throws when subject is empty', async () => {
    await expect(freshdesk.createTicket('key', 'acme', ' ', 'desc', 'a@example.com')).rejects.toThrow(IntegrationError);
  });

  it('throws when add note body is empty', async () => {
    await expect(freshdesk.addNote('key', 'acme', 1, ' ')).rejects.toThrow(IntegrationError);
  });
});
