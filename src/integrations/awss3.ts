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
    'x-amz-date': new Date().toISOString(),
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

export async function listBuckets(
  accessKeyId: string,
  secretKey: string,
  region: string
): Promise<Array<{ name: string; creationDate: string }>> {
  const normalizedRegion = region.trim() || DEFAULT_REGION;
  const xml = await fetchXml(
    `https://s3.${normalizedRegion}.amazonaws.com/`,
    buildAuthHeaders(accessKeyId, secretKey),
    'AWS S3のバケット一覧取得に失敗しました。'
  );
  const names = getMatches(xml, /<Name>(.*?)<\/Name>/g);
  const creationDates = getMatches(xml, /<CreationDate>(.*?)<\/CreationDate>/g);

  return names.map((name, index) => ({
    name,
    creationDate: creationDates[index] ?? '',
  }));
}

export async function listObjects(
  accessKeyId: string,
  secretKey: string,
  region: string,
  bucket: string,
  prefix?: string
): Promise<Array<{ key: string; size: number; lastModified: string }>> {
  const normalizedRegion = region.trim() || DEFAULT_REGION;
  const normalizedBucket = bucket.trim();

  if (!normalizedBucket) {
    throw new IntegrationError('AWS S3のbucketを指定してください。');
  }

  const prefixParam = prefix?.trim() ?? '';
  const xml = await fetchXml(
    `https://s3.${normalizedRegion}.amazonaws.com/${encodeURIComponent(
      normalizedBucket
    )}?list-type=2&prefix=${encodeURIComponent(prefixParam)}`,
    buildAuthHeaders(accessKeyId, secretKey),
    'AWS S3のオブジェクト一覧取得に失敗しました。'
  );
  const keys = getMatches(xml, /<Key>(.*?)<\/Key>/g);
  const sizes = getMatches(xml, /<Size>(.*?)<\/Size>/g);
  const lastModifiedValues = getMatches(xml, /<LastModified>(.*?)<\/LastModified>/g);

  return keys.map((key, index) => ({
    key,
    size: Number(sizes[index] ?? '0') || 0,
    lastModified: lastModifiedValues[index] ?? '',
  }));
}
