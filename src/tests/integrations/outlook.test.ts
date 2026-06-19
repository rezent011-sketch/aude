jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as outlook from '../../integrations/outlook';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('outlook', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('gets emails on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ value: [{ id: 'm1', subject: 'Hello', from: { emailAddress: { address: 'a@example.com' } }, receivedDateTime: '2026-06-20T00:00:00Z', isRead: true }] } as never);
    await expect(outlook.getEmails('token')).resolves.toEqual([
      { id: 'm1', subject: 'Hello', from: 'a@example.com', receivedDateTime: '2026-06-20T00:00:00Z', isRead: true },
    ]);
  });

  it('throws when send recipient is empty', async () => {
    await expect(outlook.sendEmail('token', ' ', 'Subject', 'Body')).rejects.toThrow(IntegrationError);
  });

  it('gets calendar events on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ value: [{ id: 'e1', subject: 'Meeting', start: { dateTime: '2026-06-20T01:00:00Z' }, end: { dateTime: '2026-06-20T02:00:00Z' }, location: { displayName: 'Room 1' } }] } as never);
    await expect(outlook.getCalendarEvents('token')).resolves.toEqual([
      { id: 'e1', subject: 'Meeting', start: '2026-06-20T01:00:00Z', end: '2026-06-20T02:00:00Z', location: 'Room 1' },
    ]);
  });
});
