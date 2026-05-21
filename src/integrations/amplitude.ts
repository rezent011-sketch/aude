import { Buffer } from 'node:buffer';
import { IntegrationError } from './errors';

const AMPLITUDE_API_BASE_URL = 'https://amplitude.com/api/2';

type AmplitudeSeriesResponse = {
  data?: {
    series?: unknown[];
    xValues?: unknown[];
  };
  error?: string;
  message?: string;
};

function normalizeCredential(value: string, name: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`Amplitudeの${name}が設定されていません。`);
  }

  return trimmed;
}

function normalizeDate(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (!trimmed || !/^\d{8}$/.test(trimmed)) {
    throw new IntegrationError(`Amplitudeの${fieldName}はYYYYMMDD形式で指定してください。`);
  }

  return trimmed;
}

function normalizeEventName(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError('Amplitudeのevent_nameを指定してください。');
  }

  return trimmed;
}

function buildAuthorizationHeader(apiKey: string, secretKey: string): string {
  const normalizedApiKey = normalizeCredential(apiKey, 'API key');
  const normalizedSecretKey = normalizeCredential(secretKey, 'secret key');
  return `Basic ${Buffer.from(`${normalizedApiKey}:${normalizedSecretKey}`).toString('base64')}`;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = (payload as { error?: unknown; message?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

function getFirstSeries(payload: AmplitudeSeriesResponse): number[] {
  const series = payload.data?.series;
  const firstSeries = Array.isArray(series?.[0]) ? series[0] : [];

  return firstSeries.map((value) => (typeof value === 'number' ? value : 0));
}

function getXValues(payload: AmplitudeSeriesResponse): string[] {
  return Array.isArray(payload.data?.xValues)
    ? payload.data.xValues.map((value) => (typeof value === 'string' ? value : ''))
    : [];
}

async function amplitudeRequest(
  path: string,
  apiKey: string,
  secretKey: string,
  fallbackMessage: string
): Promise<AmplitudeSeriesResponse> {
  let response: Response;

  try {
    response = await fetch(`${AMPLITUDE_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Authorization: buildAuthorizationHeader(apiKey, secretKey),
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as AmplitudeSeriesResponse | null;

  if (!response.ok) {
    const apiMessage = extractErrorMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload ?? {};
}

export async function getActiveUsers(
  apiKey: string,
  secretKey: string,
  start: string,
  end: string
): Promise<Array<{ date: string; value: number }>> {
  const normalizedStart = normalizeDate(start, 'start');
  const normalizedEnd = normalizeDate(end, 'end');
  const payload = await amplitudeRequest(
    `/users?start=${encodeURIComponent(normalizedStart)}&end=${encodeURIComponent(normalizedEnd)}`,
    apiKey,
    secretKey,
    'Amplitudeのアクティブユーザー取得に失敗しました。'
  );

  const series = getFirstSeries(payload);
  return getXValues(payload).map((date, index) => ({
    date,
    value: series[index] || 0,
  }));
}

export async function getEventCounts(
  apiKey: string,
  secretKey: string,
  eventName: string,
  start: string,
  end: string
): Promise<Array<{ date: string; count: number }>> {
  const normalizedEventName = normalizeEventName(eventName);
  const normalizedStart = normalizeDate(start, 'start');
  const normalizedEnd = normalizeDate(end, 'end');
  const eventQuery = JSON.stringify({ event_type: normalizedEventName });
  const payload = await amplitudeRequest(
    `/events/segmentation?e=${encodeURIComponent(eventQuery)}&start=${encodeURIComponent(normalizedStart)}&end=${encodeURIComponent(normalizedEnd)}&m=totals`,
    apiKey,
    secretKey,
    'Amplitudeのイベント件数取得に失敗しました。'
  );

  const series = getFirstSeries(payload);
  return getXValues(payload).map((date, index) => ({
    date,
    count: series[index] || 0,
  }));
}
