import { createJsonResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as yayoi from '../../integrations/yayoi';

describe('yayoi', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('gets trial balance on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        items: [
          {
            account_name: 'Cash',
            debit_amount: 1000,
            credit_amount: 0,
            balance: 1000,
          },
        ],
      })
    );

    await expect(yayoi.getTrialBalance('token')).resolves.toEqual([
      {
        account_name: 'Cash',
        debit_amount: 1000,
        credit_amount: 0,
        balance: 1000,
      },
    ]);
  });

  it('throws when token missing', async () => {
    await expect(yayoi.getTrialBalance(' ')).rejects.toThrow(IntegrationError);
  });

  it('throws when amount invalid', async () => {
    await expect(yayoi.createJournalEntry('token', '2026-06-20', 'Cash', 'Sales', 0, 'desc')).rejects.toThrow(
      IntegrationError
    );
  });
});
