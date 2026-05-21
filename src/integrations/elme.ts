import { IntegrationError } from './errors';
import { Client, TextChannel } from 'discord.js';

export type ElmeWebhookEvent = {
  event: string;
  userId: string;
  displayName?: string;
  message?: string;
  tagName?: string;
  scenarioName?: string;
  timestamp: number;
};

export function parseElmeWebhook(body: unknown): ElmeWebhookEvent {
  if (
    typeof body !== 'object' || body === null ||
    typeof (body as Record<string, unknown>).event !== 'string' ||
    typeof (body as Record<string, unknown>).userId !== 'string'
  ) {
    throw new IntegrationError('エルメ Webhookのペイロードが不正です。event と userId が必須です。');
  }
  const b = body as Record<string, unknown>;
  return {
    event: b.event as string,
    userId: b.userId as string,
    displayName: typeof b.displayName === 'string' ? b.displayName : undefined,
    message: typeof b.message === 'string' ? b.message : undefined,
    tagName: typeof b.tagName === 'string' ? b.tagName : undefined,
    scenarioName: typeof b.scenarioName === 'string' ? b.scenarioName : undefined,
    timestamp: typeof b.timestamp === 'number' ? b.timestamp : Date.now(),
  };
}

export function formatElmeEventMessage(event: ElmeWebhookEvent): string {
  const name = event.displayName ?? event.userId;
  switch (event.event) {
    case 'follow':
      return `👤 [エルメ] 新規フォロー: ${name} (${event.userId})`;
    case 'unfollow':
      return `👋 [エルメ] フォロー解除: ${name} (${event.userId})`;
    case 'message':
      return `💬 [エルメ] メッセージ受信: ${name} → ${event.message ?? '(本文なし)'}`;
    case 'tag_added':
      return `🏷️ [エルメ] タグ追加: ${name} に [${event.tagName ?? '不明'}] が付与されました`;
    case 'scenario_started':
      return `▶️ [エルメ] シナリオ開始: ${name} が [${event.scenarioName ?? '不明'}] を開始しました`;
    case 'scenario_completed':
      return `✅ [エルメ] シナリオ完了: ${name} が [${event.scenarioName ?? '不明'}] を完了しました`;
    default:
      return `📌 [エルメ] イベント [${event.event}]: ${event.userId}`;
  }
}

export async function forwardElmeToDiscord(
  discordClient: Client,
  channelId: string,
  event: ElmeWebhookEvent
): Promise<void> {
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new IntegrationError(`Discord チャンネル ${channelId} が見つからないか、テキストチャンネルではありません。`);
  }
  await channel.send(formatElmeEventMessage(event));
}
