import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as kintone from '../../integrations/kintone';

describe('kintone', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets records on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ records: [{ name: { value: 'Alice' } }], totalCount: '1' }));

    await expect(kintone.getRecords('sub', 'token', 1)).resolves.toEqual({ records: [{ name: { value: 'Alice' } }], totalCount: '1' });
  });

  it('throws when app id is invalid', async () => {
    await expect(kintone.getRecords('sub', 'token', 0)).rejects.toThrow(IntegrationError);
  });

  it('creates record on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ id: '10' }));
    await expect(kintone.createRecord('sub', 'token', 1, { name: { value: 'Alice' } })).resolves.toEqual({ id: '10' });
  });
});
