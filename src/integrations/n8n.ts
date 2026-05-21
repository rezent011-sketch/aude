import { IntegrationError } from './errors';
import { fetchJson } from './http';

type N8nWorkflowItem = {
  id?: string;
  name?: string;
  active?: boolean;
  createdAt?: string;
};

type N8nWorkflowsResponse = {
  data?: N8nWorkflowItem[];
};

function normalizeWebhookUrl(webhookUrl: string): string {
  const trimmed = webhookUrl.trim();

  if (!trimmed) {
    throw new IntegrationError('n8nのwebhook_urlを指定してください。');
  }

  return trimmed;
}

function normalizeApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new IntegrationError('n8n APIキーが設定されていません。');
  }

  return trimmed;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');

  if (!trimmed) {
    throw new IntegrationError('n8nのbase_urlを指定してください。');
  }

  return trimmed;
}

export async function triggerWorkflow(
  webhookUrl: string,
  data: Record<string, unknown>
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(normalizeWebhookUrl(webhookUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        _source: 'aude_discord',
        _timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    throw new IntegrationError('n8n Webhookの呼び出しに失敗しました。', { cause: error });
  }

  if (!response.ok) {
    throw new IntegrationError('n8n Webhookの呼び出しに失敗しました。');
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => '');
}

export async function getWorkflows(
  baseUrl: string,
  apiKey: string
): Promise<Array<{ id: string; name: string; active: boolean; createdAt: string }>> {
  const response = await fetchJson<N8nWorkflowsResponse>(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workflows`,
    {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': normalizeApiKey(apiKey),
        Accept: 'application/json',
      },
    },
    'n8nのワークフロー一覧取得に失敗しました。'
  );

  return (response.data ?? []).map((workflow) => ({
    id: typeof workflow.id === 'string' ? workflow.id : '',
    name:
      typeof workflow.name === 'string' && workflow.name.trim() ? workflow.name : '(No name)',
    active: workflow.active === true,
    createdAt: typeof workflow.createdAt === 'string' ? workflow.createdAt : '',
  }));
}
