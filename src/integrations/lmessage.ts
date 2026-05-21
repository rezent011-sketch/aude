import { IntegrationError } from './errors';
import { Client, TextChannel } from 'discord.js';

export type LmessageWebhookEvent = {
  event: string;
  userId: string;
  displayName?: string;
  message?: string;
  buttonLabel?: string;
  richMenuName?: string;
  timestamp: number;
};

export function parseLmessageWebhook(body: unknown): LmessageWebhookEvent {
  if (
    typeof body !== 'object' || body === null ||
    typeof (body as Record<string, unknown>).event !== 'string' ||
    typeof (body as Record<string, unknown>).userId !== 'string'
  ) {
    throw new IntegrationError('Lメッセージ Webhookのペイロードが不正です。event と userId が必須です。');
  }
  const b = body as Record<string, unknown>;
  return {
    event: b.event as string,
    userId: b.userId as string,
    displayName: typeof b.displayName === 'string' ? b.displayName : undefined,
    message: typeof b.message === 'string' ? b.message : undefined,
    buttonLabel: typeof b.buttonLabel === 'string' ? b.buttonLabel : undefined,
    richMenuName: typeof b.richMenuName === 'string' ? b.richMenuName : undefined,
    timestamp: typeof b.timestamp === 'number' ? b.timestamp : Date.now(),
  };
}

export function formatLmessageEventMessage(event: LmessageWebhookEvent): string {
  const name = event.displayName ?? event.userId;
  switch (event.event) {
    case 'follow':
      return `👤 [Lメッセージ] 新規フォロー: ${name} (${event.userId})`;
    case 'unfollow':
      return `👋 [Lメッセージ] ブロック: ${name} (${event.userId})`;
    case 'message':
      return `💬 [Lメッセージ] メッセージ: ${name} → ${event.message ?? '(本文なし)'}`;
    case 'button_click':
      return `🔘 [Lメッセージ] ボタンタップ: ${name} が [${event.buttonLabel ?? '不明'}] をタップ`;
    case 'richmenu_tap':
      return `📋 [Lメッセージ] リッチメニュータップ: ${name} → ${event.richMenuName ?? '不明'}`;
    default:
      return `📌 [Lメッセージ] イベント [${event.event}]: ${event.userId}`;
  }
}

export async function forwardLmessageToDiscord(
  discordClient: Client,
  channelId: string,
  event: LmessageWebhookEvent
): Promise<void> {
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new IntegrationError(`Discord チャンネル ${channelId} が見つからないか、テキストチャンネルではありません。`);
  }
  await channel.send(formatLmessageEventMessage(event));
}
