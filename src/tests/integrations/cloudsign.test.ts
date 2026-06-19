import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as cloudsign from '../../integrations/cloudsign';

describe('cloudsign', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists documents on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        documents: [{ id: 'doc-1', title: 'Agreement', status: 'completed', created_at: '2026-06-20' }],
      })
    );

    await expect(cloudsign.getDocuments('token')).resolves.toEqual([
      { id: 'doc-1', title: 'Agreement', status: 'completed', created_at: '2026-06-20' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(cloudsign.getDocuments(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when title is empty', async () => {
    await expect(cloudsign.createDocument('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
