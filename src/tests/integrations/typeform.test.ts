import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as typeform from '../../integrations/typeform';

describe('typeform', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets forms on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        items: [
          {
            id: 'form-1',
            title: 'Survey Form',
            last_updated_at: '2026-06-20T00:00:00Z',
          },
        ],
      })
    );

    await expect(typeform.getForms('token')).resolves.toEqual([
      {
        id: 'form-1',
        title: 'Survey Form',
        last_updated_at: '2026-06-20T00:00:00Z',
        response_count: 0,
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(typeform.getForms(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when form id missing', async () => {
    await expect(typeform.getResponses('token', ' ')).rejects.toThrow(IntegrationError);
  });
});
