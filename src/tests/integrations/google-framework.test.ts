jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import * as google from '../../integrations/google';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('google calendar framework', () => {
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

  it('lists calendar events for a custom range', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ access_token: 'access' } as never)
      .mockResolvedValueOnce({
        items: [
          {
            id: 'evt-1',
            summary: 'Planning',
            htmlLink: 'https://calendar.google.com/event?eid=1',
            start: { dateTime: '2026-06-20T01:00:00Z' },
            end: { dateTime: '2026-06-20T02:00:00Z' },
          },
        ],
      } as never);

    await expect(
      google.listCalendarEvents({
        calendarId: 'team@example.com',
        timeMin: '2026-06-20T00:00:00.000Z',
        timeMax: '2026-06-21T00:00:00.000Z',
        maxResults: 25,
        query: 'Planning',
      })
    ).resolves.toEqual([
      {
        id: 'evt-1',
        title: 'Planning',
        url: 'https://calendar.google.com/event?eid=1',
        start: '2026-06-20T01:00:00Z',
        end: '2026-06-20T02:00:00Z',
        isAllDay: false,
      },
    ]);
  });

  it('creates a calendar event with explicit end time', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ access_token: 'access' } as never)
      .mockResolvedValueOnce({
        id: 'evt-2',
        summary: 'Demo',
        htmlLink: 'https://calendar.google.com/event?eid=2',
        start: { dateTime: '2026-06-20T03:00:00.000Z' },
        end: { dateTime: '2026-06-20T04:00:00.000Z' },
      } as never);

    await expect(
      google.createCalendarEvent({
        title: 'Demo',
        start: '2026-06-20T03:00:00.000Z',
        end: '2026-06-20T04:00:00.000Z',
        description: 'Sprint demo',
        calendarId: 'team@example.com',
      })
    ).resolves.toEqual({
      id: 'evt-2',
      title: 'Demo',
      url: 'https://calendar.google.com/event?eid=2',
      start: '2026-06-20T03:00:00.000Z',
      end: '2026-06-20T04:00:00.000Z',
    });
  });
});
