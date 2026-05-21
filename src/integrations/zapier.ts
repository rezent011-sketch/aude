import { IntegrationError } from './errors';

function normalizeWebhookUrl(webhookUrl: string): string {
  const trimmed = webhookUrl.trim();

  if (!trimmed) {
    throw new IntegrationError('Zapierのwebhook_urlを指定してください。');
  }

  return trimmed;
}

export async function triggerZap(
  webhookUrl: string,
  data: Record<string, unknown>
): Promise<{ status: string }> {
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
    throw new IntegrationError('Zapier Webhookの呼び出しに失敗しました。', { cause: error });
  }

  if (!response.ok) {
    throw new IntegrationError('Zapier Webhookの呼び出しに失敗しました。');
  }

  return { status: 'triggered' };
}

export async function testWebhook(webhookUrl: string): Promise<boolean> {
  await triggerZap(webhookUrl, {
    test: true,
    message: 'Aude test connection',
  });

  return true;
}
