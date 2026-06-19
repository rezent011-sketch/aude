import { createTextResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as awss3 from '../../integrations/awss3';

describe('awss3', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists buckets on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createTextResponse('<Name>bucket-a</Name><CreationDate>2026-06-01</CreationDate>')
    );

    await expect(awss3.listBuckets('key', 'secret', 'ap-northeast-1')).resolves.toEqual([
      { name: 'bucket-a', creationDate: '2026-06-01' },
    ]);
  });

  it('throws when credentials are missing', async () => {
    await expect(awss3.listBuckets(' ', 'secret', 'ap-northeast-1')).rejects.toThrow(IntegrationError);
  });

  it('throws when bucket is empty', async () => {
    await expect(awss3.listObjects('key', 'secret', 'ap-northeast-1', ' ')).rejects.toThrow(IntegrationError);
  });
});
