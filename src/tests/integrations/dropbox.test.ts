jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as dropbox from '../../integrations/dropbox';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('dropbox', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('lists folder entries on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      entries: [{ id: 'id:1', name: 'Docs', path_display: '/Docs', '.tag': 'folder' }],
    } as never);

    await expect(dropbox.listFolder('token', '/')).resolves.toEqual([
      { id: 'id:1', name: 'Docs', path_display: '/Docs', is_folder: true, size: undefined },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(dropbox.listFolder(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when query is empty', async () => {
    await expect(dropbox.search('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
