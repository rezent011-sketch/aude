import { IntegrationError } from './errors';

const GOOGLE_ANALYTICS_API_BASE_URL = 'https://analyticsdata.googleapis.com/v1beta';

type GoogleAnalyticsRunReportResponse = {
  rows?: Array<{
    metricValues?: Array<{
      value?: string;
    }>;
    dimensionValues?: Array<{
      value?: string;
    }>;
  }>;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Google Analyticsのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function normalizePropertyId(propertyId: string): string {
  const trimmed = propertyId.trim();

  if (!trimmed) {
    throw new IntegrationError('Google Analyticsのproperty_idを指定してください。');
  }

  return trimmed;
}

async function googleAnalyticsRequest<T>(
  token: string,
  propertyId: string,
  body: Record<string, unknown>,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      `${GOOGLE_ANALYTICS_API_BASE_URL}/properties/${normalizePropertyId(propertyId)}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${normalizeToken(token)}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      }
    );
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new IntegrationError(fallbackMessage);
  }

  return payload as T;
}

export async function runReport(
  token: string,
  propertyId: string,
  metrics: string[],
  dimensions: string[],
  dateRange?: { startDate: string; endDate: string }
): Promise<Array<Record<string, string>>> {
  const normalizedMetrics = metrics.map((metric) => metric.trim()).filter(Boolean);
  const normalizedDimensions = dimensions.map((dimension) => dimension.trim()).filter(Boolean);

  if (normalizedMetrics.length === 0) {
    throw new IntegrationError('Google Analyticsのmetricsを1つ以上指定してください。');
  }

  const response = await googleAnalyticsRequest<GoogleAnalyticsRunReportResponse>(
    token,
    propertyId,
    {
      dateRanges: [
        {
          startDate: dateRange?.startDate || '7daysAgo',
          endDate: dateRange?.endDate || 'today',
        },
      ],
      metrics: normalizedMetrics.map((name) => ({ name })),
      dimensions: normalizedDimensions.map((name) => ({ name })),
    },
    'Google Analyticsのレポート取得に失敗しました。'
  );

  return (response.rows ?? []).map((row) => {
    const obj: Record<string, string> = {};

    normalizedDimensions.forEach((dimension, index) => {
      obj[dimension] = row.dimensionValues?.[index]?.value ?? '';
    });

    normalizedMetrics.forEach((metric, index) => {
      obj[metric] = row.metricValues?.[index]?.value ?? '';
    });

    return obj;
  });
}

export async function getActiveUsers(
  token: string,
  propertyId: string
): Promise<{ today: string; last7days: string; last30days: string }> {
  const [todayRows, last7daysRows, last30daysRows] = await Promise.all([
    runReport(token, propertyId, ['activeUsers'], [], {
      startDate: 'today',
      endDate: 'today',
    }),
    runReport(token, propertyId, ['activeUsers'], [], {
      startDate: '7daysAgo',
      endDate: 'today',
    }),
    runReport(token, propertyId, ['activeUsers'], [], {
      startDate: '30daysAgo',
      endDate: 'today',
    }),
  ]);

  return {
    today: todayRows[0]?.activeUsers || '0',
    last7days: last7daysRows[0]?.activeUsers || '0',
    last30days: last30daysRows[0]?.activeUsers || '0',
  };
}

export async function getPageViews(
  token: string,
  propertyId: string
): Promise<Array<{ pagePath: string; screenPageViews: string }>> {
  const rows = await runReport(
    token,
    propertyId,
    ['screenPageViews'],
    ['pagePath'],
    {
      startDate: '7daysAgo',
      endDate: 'today',
    }
  );

  return rows.map((row) => ({
    pagePath: row.pagePath || '',
    screenPageViews: row.screenPageViews || '0',
  }));
}
