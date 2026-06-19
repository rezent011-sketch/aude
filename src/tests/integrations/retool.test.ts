jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as retool from '../../integrations/retool';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('retool', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('gets apps on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'app-1',
          name: 'Admin',
          pageUuid: 'page-1',
          createdAt: '2026-06-20T00:00:00Z',
          updatedAt: '2026-06-21T00:00:00Z',
        },
      ],
    } as never);

    await expect(retool.getApps('token')).resolves.toEqual([
      {
        id: 'app-1',
        name: 'Admin',
        pageUuid: 'page-1',
        createdAt: '2026-06-20T00:00:00Z',
        updatedAt: '2026-06-21T00:00:00Z',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(retool.getApps(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when response marks failure', async () => {
    fetchJsonMock.mockResolvedValueOnce({ success: false, data: [] } as never);
    await expect(retool.getUsers('token')).rejects.toThrow(IntegrationError);
  });
});
