import { IntegrationError } from './errors';

async function sendWebhookPayload(
  webhookUrl: string,
  body: Record<string, unknown>,
  fallbackMessage: string
): Promise<void> {
  const normalizedWebhookUrl = webhookUrl.trim();

  if (!normalizedWebhookUrl) {
    throw new IntegrationError('Discordのwebhook_urlを指定してください。');
  }

  let response: Response;

  try {
    response = await fetch(normalizedWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new IntegrationError(fallbackMessage, { cause: error });
  }

  if (response.status === 200 || response.status === 204) {
    return;
  }

  const payload = await response.text().catch(() => '');
  throw new IntegrationError(payload ? `${fallbackMessage} (${payload})` : fallbackMessage);
}

export async function sendWebhookMessage(
  webhookUrl: string,
  content: string,
  username?: string
): Promise<void> {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new IntegrationError('Discordに送信するmessageを指定してください。');
  }

  await sendWebhookPayload(
    webhookUrl,
    {
      content: normalizedContent,
      username: username?.trim() || 'Aude',
    },
    'Discord Webhookへのメッセージ送信に失敗しました。'
  );
}

export async function sendEmbedMessage(
  webhookUrl: string,
  title: string,
  description: string,
  color?: number
): Promise<void> {
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedTitle) {
    throw new IntegrationError('Discord Embedのtitleを指定してください。');
  }

  if (!normalizedDescription) {
    throw new IntegrationError('Discord Embedのdescriptionを指定してください。');
  }

  await sendWebhookPayload(
    webhookUrl,
    {
      embeds: [
        {
          title: normalizedTitle,
          description: normalizedDescription,
          color: typeof color === 'number' ? color : 0x5865f2,
        },
      ],
    },
    'Discord WebhookへのEmbed送信に失敗しました。'
  );
}
