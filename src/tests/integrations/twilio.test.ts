import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as twilio from '../../integrations/twilio';

describe('twilio', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets messages on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        messages: [
          {
            sid: 'SM1',
            from: '+810000000001',
            to: '+810000000002',
            body: 'hello',
            status: 'sent',
            date_sent: 'Sat, 20 Jun 2026 00:00:00 +0000',
          },
        ],
      })
    );

    await expect(twilio.getMessages('AC123', 'auth-token')).resolves.toEqual([
      {
        sid: 'SM1',
        from: '+810000000001',
        to: '+810000000002',
        body: 'hello',
        status: 'sent',
        date_sent: 'Sat, 20 Jun 2026 00:00:00 +0000',
      },
    ]);
  });

  it('throws when account sid missing', async () => {
    await expect(twilio.getMessages(' ', 'auth-token')).rejects.toThrow(IntegrationError);
  });

  it('throws when message body missing', async () => {
    await expect(twilio.sendSms('AC123', 'auth-token', '+8101', '+8102', ' ')).rejects.toThrow(
      IntegrationError
    );
  });
});
