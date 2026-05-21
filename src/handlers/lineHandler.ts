/**
 * LINE Bot Handler
 *
 * LINEのDMでDiscordと同じようにAudeと会話できる。
 *
 * セットアップ手順:
 * 1. LINE Developers Console (https://developers.line.biz/) でチャンネル作成
 * 2. Messaging API チャンネルを選択
 * 3. Channel Access Token を発行 → .env の LINE_CHANNEL_ACCESS_TOKEN に設定
 * 4. Webhook URL を設定: https://your-domain.com/webhook/line
 * 5. 「Webhookの利用」を ON にする
 * 6. 「応答メッセージ」を OFF にする（AudeのAI応答と競合するため）
 *
 * 動作:
 * - LINEのDMでテキストを送ると → AI（Claude/GPT-4o）が返答
 * - 会話履歴・メモリ・クレジットはDiscordと完全共有
 * - LINE userIdに 'line_' プレフィックスを付けてDB管理
 */
import { ConversationHistory } from '../conversation/history';
import {
  creditsChecker,
  InsufficientCreditsError,
  INSUFFICIENT_CREDITS_MESSAGE,
} from '../credits/checker';
import { creditsManager } from '../credits/manager';
import UserRepository from '../db/userRepository';
import { resolveModelChoice, routeToLLM } from '../llm/router';
import {
  buildMemoryContext,
  extractMemoriesFromConversation,
} from '../services/memoryService';
import { replyMessage } from '../integrations/line';
import { IntegrationError } from '../integrations/errors';

const lineConversationHistory = new ConversationHistory(10);

export interface LineWebhookEvent {
  type: string;
  replyToken: string;
  source: {
    type: string;
    userId: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  timestamp: number;
}

export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

function getLineToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new IntegrationError('LINE_CHANNEL_ACCESS_TOKEN が設定されていません。');
  }
  return token;
}

function toDiscordId(lineUserId: string): string {
  return `line_${lineUserId}`;
}

export async function handleLineMessage(event: LineWebhookEvent): Promise<void> {
  if (event.type !== 'message' || event.message?.type !== 'text') {
    return;
  }

  const prompt = event.message.text?.trim();
  if (!prompt || !event.replyToken) {
    return;
  }

  const lineUserId = event.source.userId;
  if (!lineUserId) {
    return;
  }

  const discordId = toDiscordId(lineUserId);
  const username = `LINE_${lineUserId.slice(0, 8)}`;
  const channelId = `line_${event.source.groupId || event.source.roomId || lineUserId}`;
  const user = UserRepository.getOrCreateUser(discordId, username);
  const selectedModel = resolveModelChoice(prompt, 'auto', channelId);

  console.log(`[LINE] userId=${lineUserId} channelId=${channelId} model=${selectedModel}`);

  let creditsCharged = false;

  try {
    creditsChecker.ensureSufficientCredits(discordId, username, selectedModel);

    const history = await lineConversationHistory.getRecent(channelId);
    const messages = [...history, { role: 'user' as const, content: prompt }];
    const memoryContext = buildMemoryContext(discordId);

    try {
      extractMemoriesFromConversation(discordId, prompt);
    } catch (memErr) {
      console.warn('[LINE Memory] Auto-extract failed:', memErr);
    }

    creditsManager.consume(discordId, username, selectedModel);
    creditsCharged = true;

    const result = await routeToLLM(
      prompt,
      selectedModel,
      messages,
      channelId,
      memoryContext || undefined,
      undefined
    );

    await lineConversationHistory.append(channelId, user.id, 'user', prompt);
    await lineConversationHistory.append(channelId, user.id, 'assistant', result);

    const token = getLineToken();
    await replyMessage(token, event.replyToken, result.slice(0, 4500));
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      const token = getLineToken();
      await replyMessage(token, event.replyToken, INSUFFICIENT_CREDITS_MESSAGE);
      return;
    }

    console.error('[LINE] Error in handleLineMessage:', error);

    if (creditsCharged) {
      try {
        creditsManager.refund(discordId, username, selectedModel, 'LLM call failed');
      } catch (refundError) {
        console.error('[LINE] Failed to refund credits:', refundError);
      }
    }

    try {
      const token = getLineToken();
      const errMsg =
        error instanceof Error
          ? error.message
          : 'エラーが発生しました。しばらくしてから再度お試しください。';
      await replyMessage(token, event.replyToken, `⚠️ ${errMsg}`);
    } catch (replyErr) {
      console.error('[LINE] Failed to send error reply:', replyErr);
    }
  }
}

export async function handleLineWebhook(body: LineWebhookBody): Promise<void> {
  await Promise.allSettled(body.events.map((event) => handleLineMessage(event)));
}
