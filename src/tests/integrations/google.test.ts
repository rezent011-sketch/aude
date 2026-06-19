jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as google from '../../integrations/google';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('google', () => {
  const originalEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  };

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.GOOGLE_CLIENT_ID = 'client';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'refresh';
  });

  afterAll(() => {
    process.env.GOOGLE_CLIENT_ID = originalEnv.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = originalEnv.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_REFRESH_TOKEN = originalEnv.GOOGLE_REFRESH_TOKEN;
  });

  it('lists today calendar events on success', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ access_token: 'access' } as never)
      .mockResolvedValueOnce({ items: [{ id: 'e1', summary: 'Meeting', htmlLink: 'https://example.com/e1', start: { dateTime: '2026-06-20T01:00:00Z' }, end: { dateTime: '2026-06-20T02:00:00Z' } }] } as never);

    await expect(google.listTodayCalendarEvents()).resolves.toEqual([
      { id: 'e1', title: 'Meeting', url: 'https://example.com/e1', start: '2026-06-20T01:00:00Z', end: '2026-06-20T02:00:00Z', isAllDay: false },
    ]);
  });

  it('throws when start datetime is invalid', async () => {
    await expect(google.addCalendarEvent('Meeting', 'invalid')).rejects.toThrow(IntegrationError);
  });

  it('formats calendar datetime', () => {
    expect(google.formatCalendarDateTime('2026-06-20')).toBe('2026-06-20 終日');
  });
});
