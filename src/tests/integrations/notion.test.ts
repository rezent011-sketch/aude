jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import * as notion from '../../integrations/notion';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('notion', () => {
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

  it('searches notion pages on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ results: [{ id: 'p1', url: 'https://notion.so/p1', last_edited_time: '2026-06-20T00:00:00Z', properties: { Name: { type: 'title', title: [{ plain_text: 'Spec' }] } } }] } as never);

    await expect(notion.searchNotionPages('Spec')).resolves.toEqual([
      { id: 'p1', title: 'Spec', url: 'https://notion.so/p1', lastEditedTime: '2026-06-20T00:00:00Z' },
    ]);
  });

  it('creates notion page on success', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ properties: { Name: { id: 'title', type: 'title' } } } as never)
      .mockResolvedValueOnce({ id: 'p2', url: 'https://notion.so/p2' } as never);

    await expect(notion.createNotionPage('Title', 'Body')).resolves.toEqual({ id: 'p2', url: 'https://notion.so/p2' });
  });

  it('returns untitled when title property is missing in search results', async () => {
    fetchJsonMock.mockResolvedValueOnce({ results: [{ id: 'p3', url: 'https://notion.so/p3', last_edited_time: '2026-06-20T00:00:00Z' }] } as never);
    await expect(notion.searchNotionPages('x')).resolves.toEqual([
      { id: 'p3', title: '無題', url: 'https://notion.so/p3', lastEditedTime: '2026-06-20T00:00:00Z' },
    ]);
  });
});
