jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as coda from '../../integrations/coda';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('coda', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('lists docs on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      items: [{ id: 'doc-1', name: 'Roadmap', owner: 'owner@example.com', createdAt: '2026-06-20' }],
    } as never);

    await expect(coda.listDocs('token')).resolves.toEqual([
      { id: 'doc-1', name: 'Roadmap', owner: 'owner@example.com', createdAt: '2026-06-20' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(coda.listDocs(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when table id is empty', async () => {
    await expect(coda.listRows('token', 'doc-1', ' ')).rejects.toThrow(IntegrationError);
  });
});
