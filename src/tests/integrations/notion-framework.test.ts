jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import * as notion from '../../integrations/notion';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('notion database query', () => {
  const originalEnv = {
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
  };

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.NOTION_API_KEY = 'token';
    process.env.NOTION_DATABASE_ID = 'db1';
  });

  afterAll(() => {
    process.env.NOTION_API_KEY = originalEnv.NOTION_API_KEY;
    process.env.NOTION_DATABASE_ID = originalEnv.NOTION_DATABASE_ID;
  });

  it('queries a notion database with title filter', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({
        properties: { Name: { id: 'title', type: 'title' } },
      } as never)
      .mockResolvedValueOnce({
        results: [
          {
            object: 'page',
            id: 'page-1',
            url: 'https://notion.so/page-1',
            last_edited_time: '2026-06-20T00:00:00Z',
            properties: {
              Name: { type: 'title', title: [{ plain_text: 'Roadmap' }] },
            },
          },
        ],
      } as never);

    await expect(notion.queryNotionDatabase('Road')).resolves.toEqual([
      {
        id: 'page-1',
        title: 'Roadmap',
        url: 'https://notion.so/page-1',
        lastEditedTime: '2026-06-20T00:00:00Z',
      },
    ]);

    expect(fetchJsonMock).toHaveBeenNthCalledWith(
      2,
      'https://api.notion.com/v1/databases/db1/query',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          page_size: 10,
          sorts: [{ direction: 'descending', timestamp: 'last_edited_time' }],
          filter: {
            property: 'Name',
            title: {
              contains: 'Road',
            },
          },
        }),
      }),
      expect.any(String)
    );
  });
});
