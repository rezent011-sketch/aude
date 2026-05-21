import { IntegrationError } from './errors';
import { Client, TextChannel } from 'discord.js';

export type LstepWebhookEvent = {
  event: string;
  userId: string;
  displayName?: string;
  message?: string;
  tagName?: string;
  timestamp: number;
};

export function parseLstepWebhook(body: unknown): LstepWebhookEvent {
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).event !== 'string' ||
    typeof (body as Record<string, unknown>).userId !== 'string'
  ) {
    throw new IntegrationError('Lステップ Webhookのペイロードが不正です。event と userId が必須です。');
  }
  const b = body as Record<string, unknown>;
  return {
    event: b.event as string,
    userId: b.userId as string,
    displayName: typeof b.displayName === 'string' ? b.displayName : undefined,
    message: typeof b.message === 'string' ? b.message : undefined,
    tagName: typeof b.tagName === 'string' ? b.tagName : undefined,
    timestamp: typeof b.timestamp === 'number' ? b.timestamp : Date.now(),
  };
}

export function formatLstepEventMessage(event: LstepWebhookEvent): string {
  const name = event.displayName ?? event.userId;
  switch (event.event) {
    case 'follow':
      return `👤 新規フォロー: ${name} (${event.userId})`;
    case 'message':
      return `💬 メッセージ受信: ${name} → ${event.message ?? '(本文なし)'}`;
    case 'tag_added':
      return `🏷️ タグ追加: ${name} に [${event.tagName ?? '不明'}] が付与されました`;
    case 'scenario_completed':
      return `✅ シナリオ完了: ${name} がシナリオを完了しました`;
    default:
      return `📌 Lステップイベント [${event.event}]: ${event.userId}`;
  }
}

export async function forwardToDiscord(
  discordClient: Client,
  channelId: string,
  event: LstepWebhookEvent
): Promise<void> {
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new IntegrationError(`Discord チャンネル ${channelId} が見つからないか、テキストチャンネルではありません。`);
  }
  const text = formatLstepEventMessage(event);
  await channel.send(text);
}
