import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as cybozu from '../../integrations/cybozu';

describe('cybozu', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists schedules on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        events: [
          {
            id: '1',
            subject: 'Standup',
            start: { dateTime: '2026-06-20T09:00:00+09:00' },
            end: { dateTime: '2026-06-20T09:30:00+09:00' },
            attendees: [{ name: 'Alice' }],
          },
        ],
      })
    );

    await expect(cybozu.getSchedules('login', 'password', 'demo', '2026-06-20')).resolves.toEqual([
      {
        id: '1',
        subject: 'Standup',
        start: '2026-06-20T09:00:00+09:00',
        end: '2026-06-20T09:30:00+09:00',
        members: ['Alice'],
      },
    ]);
  });

  it('throws when password is missing', async () => {
    await expect(cybozu.getSchedules('login', ' ', 'demo', '2026-06-20')).rejects.toThrow(IntegrationError);
  });

  it('throws when subject is empty', async () => {
    await expect(cybozu.createSchedule('login', 'password', 'demo', ' ', '2026-06-20', '2026-06-20')).rejects.toThrow(
      IntegrationError
    );
  });
});
