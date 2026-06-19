import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as freeesign from '../../integrations/freeesign';

describe('freeesign', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists contracts on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ contracts: [{ id: 'c1', title: 'NDA', status: 'sent', created_at: '2026-06-20' }] })
    );

    await expect(freeesign.getContracts('token')).resolves.toEqual([
      { id: 'c1', title: 'NDA', status: 'sent', created_at: '2026-06-20' },
    ]);
  });

  it('throws when signer emails are empty', async () => {
    await expect(freeesign.createContract('token', 'Agreement', [])).rejects.toThrow(IntegrationError);
  });

  it('throws when contract detail request fails', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ message: 'failed' }, false, 500));
    await expect(freeesign.getContract('token', 'c1')).rejects.toThrow(IntegrationError);
  });
});
