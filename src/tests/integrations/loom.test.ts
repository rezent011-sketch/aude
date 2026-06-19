import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as loom from '../../integrations/loom';

describe('loom', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets videos on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ videos: [{ id: 'v1', title: 'Demo', duration: 30, created_at: '2026-06-20', share_url: 'https://loom.com/share/v1' }] }));

    await expect(loom.getVideos('token')).resolves.toEqual([
      { id: 'v1', title: 'Demo', duration: 30, created_at: '2026-06-20', share_url: 'https://loom.com/share/v1' },
    ]);
  });

  it('throws when video id is empty', async () => {
    await expect(loom.getVideo('token', ' ')).rejects.toThrow(IntegrationError);
  });

  it('gets single video on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ id: 'v1', title: 'Demo', duration: 30, view_count: 12, share_url: 'https://loom.com/share/v1' }));
    await expect(loom.getVideo('token', 'v1')).resolves.toEqual({ id: 'v1', title: 'Demo', duration: 30, view_count: 12, share_url: 'https://loom.com/share/v1' });
  });
});
