import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as receptionist from '../../integrations/receptionist';

describe('receptionist', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets visitors on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        visitors: [
          {
            id: 'v1',
            visitor_name: 'Alice',
            company: 'Acme',
            host_name: 'Bob',
            checked_in_at: '2026-06-20T00:00:00Z',
            status: 'checked_in',
          },
        ],
      })
    );

    await expect(receptionist.getVisitors('token')).resolves.toEqual([
      {
        id: 'v1',
        visitor_name: 'Alice',
        company: 'Acme',
        host_name: 'Bob',
        checked_in_at: '2026-06-20T00:00:00Z',
        status: 'checked_in',
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(receptionist.getVisitors(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when host name missing', async () => {
    await expect(receptionist.createVisitorNotification('token', ' ', 'Alice', 'Acme')).rejects.toThrow(
      IntegrationError
    );
  });
});
