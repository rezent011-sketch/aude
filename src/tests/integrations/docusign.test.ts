import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as docusign from '../../integrations/docusign';

describe('docusign', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists envelopes on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        envelopes: [
          { envelopeId: 'env-1', emailSubject: 'Contract', status: 'sent', sentDateTime: '2026-06-20T00:00:00Z' },
        ],
      })
    );

    await expect(docusign.getEnvelopes('token', 'account')).resolves.toEqual([
      { envelopeId: 'env-1', subject: 'Contract', status: 'sent', sentDateTime: '2026-06-20T00:00:00Z' },
    ]);
  });

  it('throws when token is missing', async () => {
    await expect(docusign.getEnvelopes(' ', 'account')).rejects.toThrow(IntegrationError);
  });

  it('throws when envelope id is empty', async () => {
    await expect(docusign.getEnvelope('token', 'account', ' ')).rejects.toThrow(IntegrationError);
  });
});
