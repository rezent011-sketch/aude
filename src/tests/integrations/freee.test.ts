import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as freee from '../../integrations/freee';

describe('freee', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists companies on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        companies: [{ id: 1, name: 'ACME', role: 'admin', display_name: 'ACME Inc.' }],
      })
    );

    await expect(freee.getCompanies('token')).resolves.toEqual([
      { id: 1, name: 'ACME', role: 'admin', display_name: 'ACME Inc.' },
    ]);
  });

  it('throws when access token is missing', async () => {
    await expect(freee.getCompanies(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when deal details are empty', async () => {
    await expect(
      freee.createDeal('token', 1, {
        issue_date: '2026-06-20',
        type: 'income',
        details: [],
      })
    ).rejects.toThrow(IntegrationError);
  });
});
