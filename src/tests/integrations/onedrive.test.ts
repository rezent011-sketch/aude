jest.mock('../../integrations/http', () => ({ fetchJson: jest.fn() }));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as onedrive from '../../integrations/onedrive';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('onedrive', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('lists files on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ value: [{ id: 'f1', name: 'Spec', size: 10, lastModifiedDateTime: '2026-06-20T00:00:00Z', webUrl: 'https://example.com/spec', folder: {} }] } as never);

    await expect(onedrive.listFiles('token')).resolves.toEqual([
      { id: 'f1', name: 'Spec', size: 10, lastModifiedDateTime: '2026-06-20T00:00:00Z', webUrl: 'https://example.com/spec', isFolder: true },
    ]);
  });

  it('throws when token is empty', async () => {
    await expect(onedrive.listFiles(' ')).rejects.toThrow(IntegrationError);
  });

  it('searches files on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({ value: [{ id: 'f1', name: 'Spec', webUrl: 'https://example.com/spec' }] } as never);
    await expect(onedrive.searchFiles('token', 'Spec')).resolves.toEqual([{ id: 'f1', name: 'Spec', webUrl: 'https://example.com/spec' }]);
  });
});
