jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as asanatasks from '../../integrations/asanatasks';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('asanatasks', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('lists my tasks on success', async () => {
    fetchJsonMock.mockResolvedValueOnce({
      data: [{ gid: 't1', name: 'Task', completed: false, due_on: '2026-06-20' }],
    } as never);

    await expect(asanatasks.getMyTasks('token', 'workspace')).resolves.toEqual([
      { gid: 't1', name: 'Task', completed: false, due_on: '2026-06-20' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(asanatasks.getWorkspaces(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when workspace is empty', async () => {
    await expect(asanatasks.getMyTasks('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
