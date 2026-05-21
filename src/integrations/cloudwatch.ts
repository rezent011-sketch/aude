import { IntegrationError } from './errors';

const DEFAULT_REGION = 'ap-northeast-1';

function buildAuthHeaders(accessKeyId: string, secretKey: string): Record<string, string> {
  const normalizedAccessKeyId = accessKeyId.trim();
  const normalizedSecretKey = secretKey.trim();

  if (!normalizedAccessKeyId || !normalizedSecretKey) {
    throw new IntegrationError('AWS認証情報が不足しています。');
  }

  return {
    Authorization: `AWS ${normalizedAccessKeyId}:${normalizedSecretKey}`,
  };
}

function getMatches(xml: string, pattern: RegExp): string[] {
  return Array.from(xml.matchAll(pattern), (match) => match[1]?.trim() ?? '');
}

async function fetchXml(url: string, headers: Record<string, string>, errorMessage: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
    });
  } catch (error) {
    throw new IntegrationError(errorMessage, { cause: error });
  }

  const body = await response.text().catch(() => '');

  if (!response.ok) {
    throw new IntegrationError(body ? `${errorMessage} (${body.slice(0, 200)})` : errorMessage);
  }

  return body;
}

export async function getAlarms(
  accessKeyId: string,
  secretKey: string,
  region: string
): Promise<Array<{ AlarmName: string; StateValue: string; MetricName: string; Namespace: string }>> {
  const normalizedRegion = region.trim() || DEFAULT_REGION;
  const xml = await fetchXml(
    `https://monitoring.${normalizedRegion}.amazonaws.com/?Action=DescribeAlarms&Version=2010-08-01`,
    buildAuthHeaders(accessKeyId, secretKey),
    'AWS CloudWatchのアラーム一覧取得に失敗しました。'
  );
  const alarmNames = getMatches(xml, /<AlarmName>(.*?)<\/AlarmName>/g);
  const stateValues = getMatches(xml, /<StateValue>(.*?)<\/StateValue>/g);
  const metricNames = getMatches(xml, /<MetricName>(.*?)<\/MetricName>/g);
  const namespaces = getMatches(xml, /<Namespace>(.*?)<\/Namespace>/g);

  return alarmNames.map((AlarmName, index) => ({
    AlarmName,
    StateValue: stateValues[index] ?? '',
    MetricName: metricNames[index] ?? '',
    Namespace: namespaces[index] ?? '',
  }));
}

export async function getMetricStatistics(
  accessKeyId: string,
  secretKey: string,
  region: string,
  namespace: string,
  metricName: string
): Promise<Array<{ Timestamp: string; Average: number }>> {
  const normalizedRegion = region.trim() || DEFAULT_REGION;
  const normalizedNamespace = namespace.trim();
  const normalizedMetricName = metricName.trim();

  if (!normalizedNamespace || !normalizedMetricName) {
    throw new IntegrationError('AWS CloudWatchのnamespaceとmetric_nameを指定してください。');
  }

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
  const params = new URLSearchParams({
    Action: 'GetMetricStatistics',
    Namespace: normalizedNamespace,
    MetricName: normalizedMetricName,
    Period: '3600',
    'Statistics.member.1': 'Average',
    StartTime: startTime.toISOString(),
    EndTime: endTime.toISOString(),
    Version: '2010-08-01',
  });
  const xml = await fetchXml(
    `https://monitoring.${normalizedRegion}.amazonaws.com/?${params.toString()}`,
    buildAuthHeaders(accessKeyId, secretKey),
    'AWS CloudWatchのメトリクス取得に失敗しました。'
  );
  const timestamps = getMatches(xml, /<Timestamp>(.*?)<\/Timestamp>/g);
  const averages = getMatches(xml, /<Average>(.*?)<\/Average>/g);

  return timestamps.map((Timestamp, index) => ({
    Timestamp,
    Average: Number(averages[index] ?? '0') || 0,
  }));
}
