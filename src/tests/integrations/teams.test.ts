jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as teams from '../../integrations/teams';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('teams', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('gets teams on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      value: [
        {
          id: 'team-1',
          displayName: 'Engineering',
          description: 'Core team',
        },
      ],
    } as never);

    await expect(teams.getTeams('token')).resolves.toEqual([
      {
        id: 'team-1',
        displayName: 'Engineering',
        description: 'Core team',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(teams.getTeams(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when channel id missing', async () => {
    await expect(teams.sendMessage('token', 'team-1', ' ', 'Hello')).rejects.toThrow(IntegrationError);
  });
});
