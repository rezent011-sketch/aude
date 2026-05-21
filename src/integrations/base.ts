import { IntegrationError } from './errors';

const BASE_API_BASE_URL = 'https://api.thebase.in/1';

type BaseShopResponse = {
  shop?: {
    shop_name?: string;
    shop_url?: string;
  };
  error?: string;
  message?: string;
};

type BaseItemsResponse = {
  items?: Array<{
    item_id?: number;
    title?: string;
    price?: number;
    stock?: number;
    visible?: number;
  }>;
  error?: string;
  message?: string;
};

type BaseOrdersResponse = {
  orders?: Array<{
    unique_key?: string;
    total?: number;
    order_status?: string;
    name?: string;
    ordered_at?: string;
  }>;
  error?: string;
  message?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('BASEのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number') {
    return 20;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new IntegrationError('BASEのlimitは正の整数で指定してください。');
  }

  return limit;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return null;
}

async function baseRequest<T>(
  path: string,
  token: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${normalizeToken(token)}`,
      },
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage = extractErrorMessage(payload);
    throw new IntegrationError(apiMessage ? `${fallbackMessage} (${apiMessage})` : fallbackMessage);
  }

  return payload as T;
}

export async function getShopInfo(
  token: string
): Promise<{ shop_name: string; shop_url: string }> {
  const response = await baseRequest<BaseShopResponse>(
    '/shop',
    token,
    'BASEのショップ情報取得に失敗しました。'
  );

  return {
    shop_name:
      typeof response.shop?.shop_name === 'string' && response.shop.shop_name.trim()
        ? response.shop.shop_name
        : '(No name)',
    shop_url: typeof response.shop?.shop_url === 'string' ? response.shop.shop_url : '',
  };
}

export async function getItems(
  token: string,
  limit?: number
): Promise<
  Array<{ item_id: number; title: string; price: number; stock: number; visible: number }>
> {
  const response = await baseRequest<BaseItemsResponse>(
    `/items?limit=${normalizeLimit(limit)}`,
    token,
    'BASEの商品一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((item) => ({
    item_id: typeof item.item_id === 'number' ? item.item_id : 0,
    title: typeof item.title === 'string' && item.title.trim() ? item.title : '(No title)',
    price: typeof item.price === 'number' ? item.price : 0,
    stock: typeof item.stock === 'number' ? item.stock : 0,
    visible: typeof item.visible === 'number' ? item.visible : 0,
  }));
}

export async function getOrders(
  token: string,
  limit?: number
): Promise<
  Array<{
    unique_key: string;
    total: number;
    order_status: string;
    name: string;
    ordered_at: string;
  }>
> {
  const response = await baseRequest<BaseOrdersResponse>(
    `/orders?limit=${normalizeLimit(limit)}`,
    token,
    'BASEの注文一覧取得に失敗しました。'
  );

  return (response.orders ?? []).map((order) => ({
    unique_key: typeof order.unique_key === 'string' ? order.unique_key : '',
    total: typeof order.total === 'number' ? order.total : 0,
    order_status:
      typeof order.order_status === 'string' && order.order_status.trim()
        ? order.order_status
        : 'unknown',
    name: typeof order.name === 'string' && order.name.trim() ? order.name : 'Guest',
    ordered_at: typeof order.ordered_at === 'string' ? order.ordered_at : '',
  }));
}
