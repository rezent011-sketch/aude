import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as gmoagree from '../../integrations/gmoagree';

describe('gmoagree', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists documents on success', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ documents: [{ document_id: 'd1', document_name: 'Contract', status: 'sent', created_at: '2026-06-20' }] }));

    await expect(gmoagree.getDocuments('key')).resolves.toEqual([
      { document_id: 'd1', document_name: 'Contract', status: 'sent', created_at: '2026-06-20' },
    ]);
  });

  it('throws when document id is empty', async () => {
    await expect(gmoagree.sendReminder('key', ' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when reminder result is not ok', async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ result: 'ng' }));
    await expect(gmoagree.sendReminder('key', 'd1')).rejects.toThrow(IntegrationError);
  });
});
