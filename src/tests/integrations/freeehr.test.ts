import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as freeehr from '../../integrations/freeehr';

describe('freeehr', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists employees on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        employees: [
          {
            id: 1,
            display_name: 'Alice',
            entry_date: '2026-04-01',
            department: { name: 'Engineering' },
          },
        ],
      })
    );

    await expect(freeehr.getEmployees('token', 1)).resolves.toEqual([
      {
        id: 1,
        display_name: 'Alice',
        entry_date: '2026-04-01',
        department: 'Engineering',
      },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(freeehr.getEmployees(' ', 1)).rejects.toThrow(IntegrationError);
  });

  it('throws when company id is invalid', async () => {
    await expect(freeehr.getPayrolls('token', 0, 2026, 6)).rejects.toThrow(IntegrationError);
  });
});
