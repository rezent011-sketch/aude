import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as airtable from '../../integrations/airtable';

describe('airtable', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists bases on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ bases: [{ id: 'base1', name: 'Main', permissionLevel: 'create' }] })
    );

    await expect(airtable.listBases('token')).resolves.toEqual([
      { id: 'base1', name: 'Main', permissionLevel: 'create' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(airtable.listBases(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when table id is empty', async () => {
    await expect(airtable.listRecords('token', 'base1', ' ')).rejects.toThrow(IntegrationError);
  });
});
