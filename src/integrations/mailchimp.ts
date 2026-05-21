import { IntegrationError } from './errors';
import { fetchJson } from './http';

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('Mailchimp APIキーが設定されていません。');
  }

  return trimmed;
}

function getServerPrefix(apiKey: string): string {
  return normalizeApiKey(apiKey).split('-').pop() || 'us1';
}

function getBaseUrl(apiKey: string): string {
  return `https://${getServerPrefix(apiKey)}.api.mailchimp.com/3.0`;
}

function getHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Basic ${Buffer.from(`anystring:${normalizeApiKey(apiKey)}`).toString('base64')}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function getLists(
  apiKey: string
): Promise<Array<{ id: string; name: string; stats: { member_count: number } }>> {
  const response = await fetchJson<{
    lists?: Array<{ id?: string; name?: string; stats?: { member_count?: number } }>;
  }>(
    `${getBaseUrl(apiKey)}/lists?count=20`,
    {
      method: 'GET',
      headers: getHeaders(apiKey),
    },
    'Mailchimpのオーディエンス一覧取得に失敗しました。'
  );

  return (response.lists ?? []).map((list) => ({
    id: list.id ?? '',
    name: list.name ?? '(No name)',
    stats: {
      member_count: list.stats?.member_count ?? 0,
    },
  }));
}

export async function getCampaigns(
  apiKey: string
): Promise<
  Array<{
    id: string;
    settings: { subject_line: string; title: string };
    status: string;
    send_time: string;
  }>
> {
  const response = await fetchJson<{
    campaigns?: Array<{
      id?: string;
      settings?: { subject_line?: string; title?: string };
      status?: string;
      send_time?: string;
    }>;
  }>(
    `${getBaseUrl(apiKey)}/campaigns?count=20`,
    {
      method: 'GET',
      headers: getHeaders(apiKey),
    },
    'Mailchimpのキャンペーン一覧取得に失敗しました。'
  );

  return (response.campaigns ?? []).map((campaign) => ({
    id: campaign.id ?? '',
    settings: {
      subject_line: campaign.settings?.subject_line ?? '',
      title: campaign.settings?.title ?? '(No title)',
    },
    status: campaign.status ?? '',
    send_time: campaign.send_time ?? '',
  }));
}

export async function getAudienceStats(
  apiKey: string,
  listId: string
): Promise<{ member_count: number; unsubscribe_count: number; open_rate: number }> {
  const normalizedListId = listId.trim();

  if (!normalizedListId) {
    throw new IntegrationError('Mailchimpのlist_idを指定してください。');
  }

  const response = await fetchJson<{
    stats?: {
      member_count?: number;
      unsubscribe_count?: number;
      open_rate?: number;
    };
  }>(
    `${getBaseUrl(apiKey)}/lists/${encodeURIComponent(normalizedListId)}`,
    {
      method: 'GET',
      headers: getHeaders(apiKey),
    },
    'Mailchimpのオーディエンス統計取得に失敗しました。'
  );

  return {
    member_count: response.stats?.member_count ?? 0,
    unsubscribe_count: response.stats?.unsubscribe_count ?? 0,
    open_rate: response.stats?.open_rate ?? 0,
  };
}
