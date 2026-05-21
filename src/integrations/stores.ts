import { IntegrationError } from './errors';

const STORES_API_BASE_URL = 'https://api.stores.jp/v1';

type StoresShopResponse = {
  shop?: {
    id?: string;
    name?: string;
    url?: string;
  };
  error?: string;
  message?: string;
};

type StoresItemsResponse = {
  items?: Array<{
    id?: string;
    name?: string;
    price?: number;
    stock_quantity?: number;
    published?: boolean;
  }>;
  error?: string;
  message?: string;
};

type StoresOrdersResponse = {
  orders?: Array<{
    id?: string;
    total_price?: number;
    fulfillment_status?: string;
    buyer?: {
      name?: string;
    } | null;
    created_at?: string;
  }>;
  error?: string;
  message?: string;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('STORESのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizePage(page: number | undefined): number {
  if (typeof page !== 'number') {
    return 1;
  }

  if (!Number.isInteger(page) || page <= 0) {
    throw new IntegrationError('STORESのpageは正の整数で指定してください。');
  }

  return page;
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

async function storesRequest<T>(
  path: string,
  token: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${STORES_API_BASE_URL}${path}`, {
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

export async function getShop(
  token: string
): Promise<{ id: string; name: string; url: string }> {
  const response = await storesRequest<StoresShopResponse>(
    '/shop',
    token,
    'STORESのショップ情報取得に失敗しました。'
  );

  return {
    id: typeof response.shop?.id === 'string' ? response.shop.id : '',
    name:
      typeof response.shop?.name === 'string' && response.shop.name.trim()
        ? response.shop.name
        : '(No name)',
    url: typeof response.shop?.url === 'string' ? response.shop.url : '',
  };
}

export async function getProducts(
  token: string,
  page?: number
): Promise<Array<{ id: string; name: string; price: number; stock: number; status: string }>> {
  const response = await storesRequest<StoresItemsResponse>(
    `/items?page=${normalizePage(page)}`,
    token,
    'STORESの商品一覧取得に失敗しました。'
  );

  return (response.items ?? []).map((item) => ({
    id: typeof item.id === 'string' ? item.id : '',
    name: typeof item.name === 'string' && item.name.trim() ? item.name : '(No name)',
    price: typeof item.price === 'number' ? item.price : 0,
    stock: typeof item.stock_quantity === 'number' ? item.stock_quantity : 0,
    status: item.published === true ? 'active' : 'inactive',
  }));
}

export async function getOrders(
  token: string,
  page?: number
): Promise<
  Array<{
    id: string;
    total: number;
    status: string;
    buyer_name: string;
    created_at: string;
  }>
> {
  const response = await storesRequest<StoresOrdersResponse>(
    `/orders?page=${normalizePage(page)}`,
    token,
    'STORESの注文一覧取得に失敗しました。'
  );

  return (response.orders ?? []).map((order) => ({
    id: typeof order.id === 'string' ? order.id : '',
    total: typeof order.total_price === 'number' ? order.total_price : 0,
    status:
      typeof order.fulfillment_status === 'string' && order.fulfillment_status.trim()
        ? order.fulfillment_status
        : 'unknown',
    buyer_name:
      typeof order.buyer?.name === 'string' && order.buyer.name.trim()
        ? order.buyer.name
        : 'Guest',
    created_at: typeof order.created_at === 'string' ? order.created_at : '',
  }));
}
