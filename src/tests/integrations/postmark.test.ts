import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as postmark from '../../integrations/postmark';

describe('postmark', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets stats on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        Sent: 10,
        Bounced: 1,
        Opens: 5,
        Clicks: 2,
        SpamComplaints: 0,
      })
    );

    await expect(postmark.getStats('token')).resolves.toEqual({
      Sent: 10,
      Bounced: 1,
      Opens: 5,
      Clicks: 2,
      SpamComplaints: 0,
    });
  });

  it('throws when token missing', async () => {
    await expect(postmark.getStats(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when recipient missing', async () => {
    await expect(postmark.sendEmail('token', 'from@example.com', ' ', 'Hello', 'Body')).rejects.toThrow(
      IntegrationError
    );
  });
});
