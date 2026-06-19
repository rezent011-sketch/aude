import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as wantedly from '../../integrations/wantedly';

describe('wantedly', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets company profile on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        company: {
          id: 1,
          name: 'Acme',
          description: 'Great company',
        },
      })
    );

    await expect(wantedly.getCompanyProfile('token')).resolves.toEqual({
      id: 1,
      name: 'Acme',
      description: 'Great company',
    });
  });

  it('throws when token missing', async () => {
    await expect(wantedly.getCompanyProfile(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when job id invalid', async () => {
    await expect(wantedly.getApplicants('token', 0)).rejects.toThrow(IntegrationError);
  });
});
