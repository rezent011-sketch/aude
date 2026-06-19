jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as canva from '../../integrations/canva';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('canva', () => {
  const originalToken = process.env.CANVA_ACCESS_TOKEN;

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.CANVA_ACCESS_TOKEN = 'canva-token';
  });

  afterAll(() => {
    process.env.CANVA_ACCESS_TOKEN = originalToken;
  });

  it('lists designs on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      items: [
        {
          id: 'design-1',
          title: 'Deck',
          created_at: 1718841600,
          updated_at: 1718928000,
          page_count: 2,
          thumbnail: { url: 'https://example.com/thumb.png' },
          urls: { edit_url: 'https://example.com/edit', view_url: 'https://example.com/view' },
        },
      ],
    } as never);

    await expect(canva.listCanvaDesigns('deck', 5)).resolves.toEqual({
      items: [
        {
          id: 'design-1',
          title: 'Deck',
          createdAt: new Date(1718841600 * 1000).toISOString(),
          updatedAt: new Date(1718928000 * 1000).toISOString(),
          pageCount: 2,
          thumbnailUrl: 'https://example.com/thumb.png',
          editUrl: 'https://example.com/edit',
          viewUrl: 'https://example.com/view',
        },
      ],
      continuation: null,
    });
  });

  it('throws when access token is missing', async () => {
    delete process.env.CANVA_ACCESS_TOKEN;
    await expect(canva.listCanvaDesigns()).rejects.toThrow(IntegrationError);
  });

  it('throws when create response is missing design', async () => {
    fetchJsonMock.mockResolvedValueOnce({} as never);
    await expect(canva.createCanvaDesign({ title: 'Draft', preset: 'doc' })).rejects.toThrow(IntegrationError);
  });
});
