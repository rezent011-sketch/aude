import { IntegrationError } from './errors';

const TIKTOK_ADS_API_BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';

type TikTokAdsResponse<T> = {
  data?: {
    list?: T[];
  };
};

type TikTokAdvertiser = {
  advertiser_id?: string;
  advertiser_name?: string;
  account_type?: string;
};

type TikTokCampaign = {
  campaign_id?: string;
  campaign_name?: string;
  operation_status?: string;
  budget?: number;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('TikTok Adsのアクセストークンが設定されていません。');
  }

  return trimmed;
}

function normalizeAdvertiserId(advertiserId: string): string {
  const trimmed = advertiserId.trim();

  if (!trimmed) {
    throw new IntegrationError('TikTok Adsのadvertiser_idを指定してください。');
  }

  return trimmed;
}

async function tiktokAdsRequest<T>(
  path: string,
  token: string,
  fallbackMessage: string,
  extraHeaders?: Record<string, string>
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${TIKTOK_ADS_API_BASE_URL}${path}`, {
      headers: extraHeaders,
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new IntegrationError(fallbackMessage);
  }

  return payload as T;
}

export async function getAdvertisers(
  token: string
): Promise<Array<{ advertiser_id: string; advertiser_name: string; status: string }>> {
  const normalizedToken = normalizeToken(token);
  const response = await tiktokAdsRequest<TikTokAdsResponse<TikTokAdvertiser>>(
    `/oauth2/advertiser/get/?access_token=${encodeURIComponent(normalizedToken)}`,
    normalizedToken,
    'TikTok Adsの広告主一覧取得に失敗しました。'
  );

  return (response.data?.list ?? []).map((advertiser) => ({
    advertiser_id: typeof advertiser.advertiser_id === 'string' ? advertiser.advertiser_id : '',
    advertiser_name:
      typeof advertiser.advertiser_name === 'string' ? advertiser.advertiser_name : '',
    status: typeof advertiser.account_type === 'string' ? advertiser.account_type : '',
  }));
}

export async function getCampaigns(
  token: string,
  advertiserId: string
): Promise<Array<{ campaign_id: string; campaign_name: string; status: string; budget: number }>> {
  const normalizedToken = normalizeToken(token);
  const response = await tiktokAdsRequest<TikTokAdsResponse<TikTokCampaign>>(
    `/campaign/get/?advertiser_id=${encodeURIComponent(normalizeAdvertiserId(advertiserId))}&access_token=${encodeURIComponent(normalizedToken)}`,
    normalizedToken,
    'TikTok Adsのキャンペーン一覧取得に失敗しました。',
    {
      'Access-Token': normalizedToken,
    }
  );

  return (response.data?.list ?? []).map((campaign) => ({
    campaign_id: typeof campaign.campaign_id === 'string' ? campaign.campaign_id : '',
    campaign_name: typeof campaign.campaign_name === 'string' ? campaign.campaign_name : '',
    status: typeof campaign.operation_status === 'string' ? campaign.operation_status : '',
    budget: typeof campaign.budget === 'number' ? campaign.budget : 0,
  }));
}
