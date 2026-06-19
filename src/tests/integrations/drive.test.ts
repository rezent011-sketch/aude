jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as drive from '../../integrations/drive';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('drive', () => {
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

  it('lists drive files on success', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ access_token: 'access-token' } as never)
      .mockResolvedValueOnce({
        files: [
          {
            id: 'file-1',
            name: 'Spec',
            mimeType: 'text/plain',
            webViewLink: 'https://example.com/spec',
            createdTime: '2026-06-20T00:00:00Z',
          },
        ],
      } as never);

    await expect(drive.listDriveFiles()).resolves.toEqual([
      {
        id: 'file-1',
        name: 'Spec',
        mimeType: 'text/plain',
        url: 'https://example.com/spec',
        createdTime: '2026-06-20T00:00:00Z',
      },
    ]);
  });

  it('throws when oauth env is missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(drive.listDriveFiles()).rejects.toThrow(IntegrationError);
  });

  it('throws when search query is empty', async () => {
    await expect(drive.searchDriveFiles(' ')).rejects.toThrow(IntegrationError);
  });
});
