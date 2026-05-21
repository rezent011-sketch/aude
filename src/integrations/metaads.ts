import { IntegrationError } from './errors';

const META_ADS_API_BASE_URL = 'https://graph.facebook.com/v19.0';

type MetaAdsListResponse<T> = {
  data?: T[];
};

type MetaAdAccount = {
  id?: string;
  name?: string;
  currency?: string;
  account_status?: number;
};

type MetaCampaign = {
  id?: string;
  name?: string;
  status?: string;
  objective?: string;
};

type MetaCampaignInsights = {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Meta Adsのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function normalizeId(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new IntegrationError(`${label}を指定してください。`);
  }

  return trimmed;
}

async function metaAdsRequest<T>(path: string, token: string, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(
      `${META_ADS_API_BASE_URL}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(normalizeToken(token))}`
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

export async function getAdAccounts(
  token: string
): Promise<Array<{ id: string; name: string; currency: string; account_status: number }>> {
  const response = await metaAdsRequest<MetaAdsListResponse<MetaAdAccount>>(
    '/me/adaccounts?fields=id,name,currency,account_status',
    token,
    'Meta Adsの広告アカウント一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((account) => ({
    id: typeof account.id === 'string' ? account.id : '',
    name: typeof account.name === 'string' ? account.name : '',
    currency: typeof account.currency === 'string' ? account.currency : '',
    account_status: typeof account.account_status === 'number' ? account.account_status : 0,
  }));
}

export async function getCampaigns(
  token: string,
  adAccountId: string
): Promise<Array<{ id: string; name: string; status: string; objective: string }>> {
  const response = await metaAdsRequest<MetaAdsListResponse<MetaCampaign>>(
    `/${normalizeId(adAccountId, 'Meta Adsのaccount_id')}/campaigns?fields=id,name,status,objective`,
    token,
    'Meta Adsのキャンペーン一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((campaign) => ({
    id: typeof campaign.id === 'string' ? campaign.id : '',
    name: typeof campaign.name === 'string' ? campaign.name : '',
    status: typeof campaign.status === 'string' ? campaign.status : '',
    objective: typeof campaign.objective === 'string' ? campaign.objective : '',
  }));
}

export async function getCampaignInsights(
  token: string,
  campaignId: string
): Promise<{ impressions: string; clicks: string; spend: string; ctr: string }> {
  const response = await metaAdsRequest<MetaAdsListResponse<MetaCampaignInsights>>(
    `/${normalizeId(campaignId, 'Meta Adsのcampaign_id')}/insights?fields=impressions,clicks,spend,ctr`,
    token,
    'Meta Adsのキャンペーンインサイト取得に失敗しました。'
  );

  const insight = response.data?.[0];

  return {
    impressions: insight?.impressions ?? '0',
    clicks: insight?.clicks ?? '0',
    spend: insight?.spend ?? '0',
    ctr: insight?.ctr ?? '0',
  };
}
