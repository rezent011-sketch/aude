import { createTextResponse, installFetchMock } from './testUtils';
import { IntegrationError } from '../../integrations/errors';
import * as cloudwatch from '../../integrations/cloudwatch';

describe('cloudwatch', () => {
  const fetchMock = installFetchMock();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('lists alarms on success', async () => {
    fetchMock.mockResolvedValueOnce(
      createTextResponse(
        '<AlarmName>CPUHigh</AlarmName><StateValue>ALARM</StateValue><MetricName>CPUUtilization</MetricName><Namespace>AWS/EC2</Namespace>'
      )
    );

    await expect(cloudwatch.getAlarms('key', 'secret', 'ap-northeast-1')).resolves.toEqual([
      {
        AlarmName: 'CPUHigh',
        StateValue: 'ALARM',
        MetricName: 'CPUUtilization',
        Namespace: 'AWS/EC2',
      },
    ]);
  });

  it('throws when credentials are missing', async () => {
    await expect(cloudwatch.getAlarms(' ', 'secret', 'ap-northeast-1')).rejects.toThrow(IntegrationError);
  });

  it('throws when namespace is empty', async () => {
    await expect(cloudwatch.getMetricStatistics('key', 'secret', 'ap-northeast-1', ' ', 'CPUUtilization')).rejects.toThrow(
      IntegrationError
    );
  });
});
