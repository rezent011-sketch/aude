jest.mock('../../integrations/http', () => ({
  fetchJson: jest.fn(),
}));

import { fetchJson } from '../../integrations/http';
import { IntegrationError } from '../../integrations/errors';
import * as sheets from '../../integrations/sheets';

const fetchJsonMock = fetchJson as jest.MockedFunction<typeof fetchJson>;

describe('sheets', () => {
  const originalEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  };

  beforeEach(() => {
    fetchJsonMock.mockReset();
    process.env.GOOGLE_CLIENT_ID = 'client';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'refresh';
  });

  afterAll(() => {
    process.env.GOOGLE_CLIENT_ID = originalEnv.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = originalEnv.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_REFRESH_TOKEN = originalEnv.GOOGLE_REFRESH_TOKEN;
  });

  it('reads sheet on success', async () => {
    fetchJsonMock
      .mockResolvedValueOnce({ access_token: 'access-token' } as never)
      .mockResolvedValueOnce({
        range: 'Sheet1!A1:B1',
        values: [['A', 'B']],
      } as never);

    await expect(sheets.readSheet('sheet-1', 'Sheet1!A1:B1')).resolves.toEqual({
      range: 'Sheet1!A1:B1',
      values: [['A', 'B']],
    });
  });

  it('throws when spreadsheet id missing', async () => {
    await expect(sheets.readSheet(' ', 'Sheet1!A1:B1')).rejects.toThrow(IntegrationError);
  });

  it('throws when create title missing', async () => {
    await expect(sheets.createSheet(' ')).rejects.toThrow(IntegrationError);
  });
});
