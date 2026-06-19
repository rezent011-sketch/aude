import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as sendgrid from '../../integrations/sendgrid';

describe('sendgrid', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets lists on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        result: [{ id: 'list-1', name: 'Newsletter', contact_count: 42 }],
      })
    );

    await expect(sendgrid.getLists('api-key')).resolves.toEqual([
      {
        id: 'list-1',
        name: 'Newsletter',
        contact_count: 42,
      },
    ]);
  });

  it('throws when api key missing', async () => {
    await expect(sendgrid.getLists(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when recipient missing', async () => {
    await expect(sendgrid.sendEmail('api-key', ' ', 'from@example.com', 'Hello', 'Body')).rejects.toThrow(
      IntegrationError
    );
  });
});
