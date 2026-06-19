jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as figmafiles from '../../integrations/figmafiles';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('figmafiles', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('gets team projects on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      projects: [{ id: 'p1', name: 'Core UI' }],
    } as never);

    await expect(figmafiles.getTeamProjects('token', 'team-1')).resolves.toEqual([{ id: 'p1', name: 'Core UI' }]);
  });

  it('throws when token is missing', async () => {
    await expect(figmafiles.getTeamProjects(' ', 'team-1')).rejects.toThrow(IntegrationError);
  });

  it('throws when file key is empty', async () => {
    await expect(figmafiles.getFileComments('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
