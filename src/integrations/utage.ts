import { IntegrationError } from './errors';
import { Client, TextChannel } from 'discord.js';

export type UtageWebhookEvent = {
  event: string;
  userId: string;
  displayName?: string;
  email?: string;
  phone?: string;
  stepName?: string;
  amount?: number;
  timestamp: number;
};

export function parseUtageWebhook(body: unknown): UtageWebhookEvent {
  if (
    typeof body !== 'object' || body === null ||
    typeof (body as Record<string, unknown>).event !== 'string' ||
    typeof (body as Record<string, unknown>).userId !== 'string'
  ) {
    throw new IntegrationError('Utage Webhookのペイロードが不正です。event と userId が必須です。');
  }
  const b = body as Record<string, unknown>;
  return {
    event: b.event as string,
    userId: b.userId as string,
    displayName: typeof b.displayName === 'string' ? b.displayName : undefined,
    email: typeof b.email === 'string' ? b.email : undefined,
    phone: typeof b.phone === 'string' ? b.phone : undefined,
    stepName: typeof b.stepName === 'string' ? b.stepName : undefined,
    amount: typeof b.amount === 'number' ? b.amount : undefined,
    timestamp: typeof b.timestamp === 'number' ? b.timestamp : Date.now(),
  };
}

export function formatUtageEventMessage(event: UtageWebhookEvent): string {
  const name = event.displayName ?? event.userId;
  switch (event.event) {
    case 'line_follow':
      return `👤 [Utage] LINE新規登録: ${name} (${event.userId})`;
    case 'line_unfollow':
      return `👋 [Utage] LINEブロック: ${name} (${event.userId})`;
    case 'email_registered':
      return `📧 [Utage] メール登録: ${name} (${event.email ?? '不明'})`;
    case 'step_completed':
      return `✅ [Utage] ステップ完了: ${name} が [${event.stepName ?? '不明'}] を完了`;
    case 'purchase':
      return `💰 [Utage] 購入完了: ${name} ¥${event.amount?.toLocaleString() ?? '不明'}`;
    default:
      return `📌 [Utage] イベント [${event.event}]: ${event.userId}`;
  }
}

export async function forwardUtageToDiscord(
  discordClient: Client,
  channelId: string,
  event: UtageWebhookEvent
): Promise<void> {
  const channel = await discordClient.channels.fetch(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    throw new IntegrationError(`Discord チャンネル ${channelId} が見つからないか、テキストチャンネルではありません。`);
  }
  await channel.send(formatUtageEventMessage(event));
}
