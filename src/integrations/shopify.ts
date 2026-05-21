import { IntegrationError } from './errors';

const SHOPIFY_API_VERSION = '2024-01';

type ShopifyListResponse<T> = {
  orders?: T[];
  products?: T[];
  variants?: T[];
  errors?: unknown;
};

function normalizeToken(token: string): string {
  const trimmed = token.trim();

  if (!trimmed) {
    throw new IntegrationError('Shopifyのaccess tokenが設定されていません。');
  }

  return trimmed;
}

function normalizeShop(shop: string): string {
  const normalized = shop.trim().replace(/^https?:\/\//, '').replace(/\.myshopify\.com\/?$/i, '');

  if (!normalized) {
    throw new IntegrationError('Shopifyのshop domainが設定されていません。');
  }

  return normalized;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number') {
    return 10;
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new IntegrationError('Shopifyのlimitは正の整数で指定してください。');
  }

  return limit;
}

function buildBaseUrl(shop: string): string {
  return `https://${normalizeShop(shop)}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}`;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const errors = (payload as { errors?: unknown }).errors;

  if (typeof errors === 'string' && errors.trim()) {
    return errors;
  }

  if (Array.isArray(errors)) {
    const messages = errors.filter(
      (message): message is string => typeof message === 'string' && Boolean(message.trim())
    );

    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  if (errors && typeof errors === 'object') {
    const messages = Object.values(errors).flatMap((value) =>
      Array.isArray(value) ? value : [value]
    );
    const normalized = messages.filter(
      (message): message is string => typeof message === 'string' && Boolean(message.trim())
    );

    if (normalized.length > 0) {
      return normalized.join(', ');
    }
  }

  return null;
}

async function shopifyRequest<T>(
  shop: string,
  token: string,
  path: string,
  fallbackMessage: string
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${buildBaseUrl(shop)}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Shopify-Access-Token': normalizeToken(token),
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

export async function getOrders(
  token: string,
  shop: string,
  limit?: number
): Promise<
  Array<{
    id: number;
    order_number: number;
    total_price: string;
    financial_status: string;
    created_at: string;
    customer_name: string;
  }>
> {
  type Order = {
    id?: number;
    order_number?: number;
    total_price?: string;
    financial_status?: string;
    created_at?: string;
    customer?: {
      first_name?: string;
      last_name?: string;
    } | null;
  };

  const response = await shopifyRequest<ShopifyListResponse<Order>>(
    shop,
    token,
    `/orders.json?limit=${normalizeLimit(limit)}&status=any`,
    'Shopifyの注文一覧取得に失敗しました。'
  );

  return (response.orders ?? []).map((order) => {
    const firstName = typeof order.customer?.first_name === 'string' ? order.customer.first_name : '';
    const lastName = typeof order.customer?.last_name === 'string' ? order.customer.last_name : '';
    const customerName = `${firstName} ${lastName}`.trim();

    return {
      id: typeof order.id === 'number' ? order.id : 0,
      order_number: typeof order.order_number === 'number' ? order.order_number : 0,
      total_price: typeof order.total_price === 'string' ? order.total_price : '0',
      financial_status:
        typeof order.financial_status === 'string' && order.financial_status.trim()
          ? order.financial_status
          : 'unknown',
      created_at: typeof order.created_at === 'string' ? order.created_at : '',
      customer_name: customerName || 'Guest',
    };
  });
}

export async function getProducts(
  token: string,
  shop: string,
  limit?: number
): Promise<
  Array<{
    id: number;
    title: string;
    status: string;
    variants_count: number;
  }>
> {
  type Product = {
    id?: number;
    title?: string;
    status?: string;
    variants?: unknown[];
  };

  const response = await shopifyRequest<ShopifyListResponse<Product>>(
    shop,
    token,
    `/products.json?limit=${normalizeLimit(limit)}`,
    'Shopifyの商品一覧取得に失敗しました。'
  );

  return (response.products ?? []).map((product) => ({
    id: typeof product.id === 'number' ? product.id : 0,
    title: typeof product.title === 'string' && product.title.trim() ? product.title : '(No title)',
    status: typeof product.status === 'string' && product.status.trim() ? product.status : 'unknown',
    variants_count: Array.isArray(product.variants) ? product.variants.length : 0,
  }));
}

export async function getInventory(
  token: string,
  shop: string,
  productId: number
): Promise<
  Array<{
    variant_id: number;
    title: string;
    inventory_quantity: number;
  }>
> {
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new IntegrationError('Shopifyのproduct_idは正の整数で指定してください。');
  }

  type Variant = {
    id?: number;
    title?: string;
    inventory_quantity?: number;
  };

  const response = await shopifyRequest<ShopifyListResponse<Variant>>(
    shop,
    token,
    `/products/${productId}/variants.json`,
    'Shopifyの在庫一覧取得に失敗しました。'
  );

  return (response.variants ?? []).map((variant) => ({
    variant_id: typeof variant.id === 'number' ? variant.id : 0,
    title: typeof variant.title === 'string' && variant.title.trim() ? variant.title : '(No title)',
    inventory_quantity:
      typeof variant.inventory_quantity === 'number' ? variant.inventory_quantity : 0,
  }));
}
