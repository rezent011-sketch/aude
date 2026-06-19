jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as figma from '../../integrations/figma';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('figma', () => {
  const originalToken = process.env.FIGMA_ACCESS_TOKEN;

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.FIGMA_ACCESS_TOKEN = 'figma-token';
  });

  afterAll(() => {
    process.env.FIGMA_ACCESS_TOKEN = originalToken;
  });

  it('gets a figma file on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      name: 'Design System',
      role: 'viewer',
      lastModified: '2026-06-20T00:00:00Z',
      thumbnailUrl: 'https://example.com/thumb.png',
      version: '123',
      document: {
        children: [
          { type: 'CANVAS', name: 'Page 1' },
          { type: 'CANVAS', name: 'Page 2' },
        ],
      },
    } as never);

    await expect(figma.getFigmaFile('file-key')).resolves.toEqual({
      key: 'file-key',
      name: 'Design System',
      role: 'viewer',
      lastModified: '2026-06-20T00:00:00Z',
      thumbnailUrl: 'https://example.com/thumb.png',
      version: '123',
      pageNames: ['Page 1', 'Page 2'],
    });
  });

  it('throws when access token is missing', async () => {
    delete process.env.FIGMA_ACCESS_TOKEN;
    await expect(figma.getFigmaFile('file-key')).rejects.toThrow(IntegrationError);
  });

  it('returns exported node urls', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      images: { '1:2': 'https://example.com/export.png' },
    } as never);

    await expect(figma.exportFigmaNodes('file-key', ['1:2'], 'png')).resolves.toEqual({
      fileKey: 'file-key',
      format: 'png',
      images: [{ nodeId: '1:2', url: 'https://example.com/export.png' }],
    });
  });
});
