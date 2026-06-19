jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as confluence from '../../integrations/confluence';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('confluence', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('lists spaces on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      results: [{ id: '1', key: 'ENG', name: 'Engineering', type: 'global' }],
    } as never);

    await expect(confluence.getSpaces('user@example.com', 'token', 'demo')).resolves.toEqual([
      { id: '1', key: 'ENG', name: 'Engineering', type: 'global' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(confluence.getSpaces('user@example.com', ' ', 'demo')).rejects.toThrow(IntegrationError);
  });

  it('throws when title is empty', async () => {
    await expect(confluence.createPage('user@example.com', 'token', 'demo', 'ENG', ' ', '<p>body</p>')).rejects.toThrow(
      IntegrationError
    );
  });
});
