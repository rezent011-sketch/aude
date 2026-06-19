import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as fireflies from '../../integrations/fireflies';

describe('fireflies', () => {
  const fetchMock = installFetchMock();
  const originalKey = process.env.FIREFLIES_API_KEY;

  beforeEach(() => {
    fetchMock.mockReset();
    process.env.FIREFLIES_API_KEY = 'fireflies-key';
  });

  afterAll(() => {
    process.env.FIREFLIES_API_KEY = originalKey;
  });

  it('lists transcripts on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: {
          transcripts: [
            {
              id: 'tr-1',
              title: 'Sync',
              dateString: '2026-06-20',
              organizer_email: 'owner@example.com',
              transcript_url: 'https://example.com/t',
              meeting_link: 'https://meet.example.com/1',
              summary: {
                short_summary: 'Summary',
                short_overview: 'Overview',
                action_items: ['follow up'],
                keywords: ['sync'],
              },
            },
          ],
        },
      })
    );

    await expect(fireflies.listFirefliesTranscripts()).resolves.toEqual([
      {
        id: 'tr-1',
        title: 'Sync',
        date: '2026-06-20',
        organizerEmail: 'owner@example.com',
        transcriptUrl: 'https://example.com/t',
        meetingLink: 'https://meet.example.com/1',
        shortSummary: 'Summary',
        shortOverview: 'Overview',
        actionItems: ['follow up'],
        keywords: ['sync'],
      },
    ]);
  });

  it('throws when api key is missing', async () => {
    delete process.env.FIREFLIES_API_KEY;
    await expect(fireflies.listFirefliesTranscripts()).rejects.toThrow(IntegrationError);
  });

  it('throws when transcript is not found', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ data: { transcript: null } }));
    await expect(fireflies.getFirefliesTranscriptSummary('tr-1')).rejects.toThrow(IntegrationError);
  });
});
