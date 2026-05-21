=== Week64: LINE Bot連携 — DiscordのDMと同じ体験をLINEで実現 ===

Aude AIはDiscordのDMで自然言語会話ができる。
同じ体験をLINE公式アカウントでも実現する。

既存の実装を最大限流用する：
- src/handlers/messageHandler.ts の handleMessage ロジック（AIルーティング・メモリ・クレジット）
- src/llm/router.ts の routeToLLM
- src/integrations/line.ts の replyMessage, getProfile
- src/conversation/history.ts の ConversationHistory
- src/credits/ の creditsChecker, creditsManager
- src/services/memoryService.ts の buildMemoryContext

---
=== TASK 1: LINE Webhookハンドラーの実装 ===

【src/handlers/lineHandler.ts を新規作成】

LINE Messaging APIのWebhookイベントを受信してAIに応答させる。

import { ConversationHistory } from '../conversation/history';
import { creditsChecker, InsufficientCreditsError, INSUFFICIENT_CREDITS_MESSAGE } from '../credits/checker';
import { creditsManager } from '../credits/manager';
import UserRepository from '../db/userRepository';
import { resolveModelChoice, routeToLLM } from '../llm/router';
import { buildMemoryContext, extractMemoriesFromConversation } from '../services/memoryService';
import { replyMessage } from '../integrations/line';
import { IntegrationError } from '../integrations/errors';

const lineConversationHistory = new ConversationHistory(10);

// LINEイベントの型定義
export interface LineWebhookEvent {
  type: string;          // 'message' | 'follow' | 'unfollow' | 'postback' etc
  replyToken: string;
  source: {
    type: string;        // 'user' | 'group' | 'room'
    userId: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    type: string;        // 'text' | 'image' | 'sticker' etc
    id: string;
    text?: string;
  };
  timestamp: number;
}

export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

// LINEチャンネルアクセストークンを環境変数から取得
function getLineToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new IntegrationError('LINE_CHANNEL_ACCESS_TOKEN が設定されていません。');
  }
  return token;
}

// LINE userId をDiscord互換の識別子として使う
// 'line_' プレフィックスを付けてDiscordのuserIdと区別
function toDiscordId(lineUserId: string): string {
  return `line_${lineUserId}`;
}

export async function handleLineMessage(event: LineWebhookEvent): Promise<void> {
  // テキストメッセージ以外は無視
  if (event.type !== 'message' || event.message?.type !== 'text') {
    return;
  }

  const prompt = event.message.text?.trim();
  if (!prompt || !event.replyToken) {
    return;
  }

  const lineUserId = event.source.userId;
  const discordId = toDiscordId(lineUserId);  // LINE userIdをDiscord ID代わりに使う
  const username = `LINE_${lineUserId.slice(0, 8)}`;
  // channelId: グループなら groupId、1対1なら userId を使う
  const channelId = `line_${event.source.groupId || event.source.roomId || lineUserId}`;

  // UserRepositoryに登録（Discord IDとして line_ プレフィックス付きで登録）
  const user = UserRepository.getOrCreateUser(discordId, username);

  const selectedModel = resolveModelChoice(prompt, 'auto', channelId);

  console.log(`[LINE] userId=${lineUserId} channelId=${channelId} model=${selectedModel}`);

  let creditsCharged = false;

  try {
    // クレジットチェック
    creditsChecker.ensureSufficientCredits(discordId, username, selectedModel);

    // 会話履歴取得
    const history = await lineConversationHistory.getRecent(channelId);
    const messages = [...history, { role: 'user' as const, content: prompt }];

    // メモリコンテキスト
    const memoryContext = buildMemoryContext(discordId);

    // バックグラウンドでメモリ抽出
    try {
      extractMemoriesFromConversation(discordId, prompt);
    } catch (memErr) {
      console.warn('[LINE Memory] Auto-extract failed:', memErr);
    }

    // クレジット消費
    creditsManager.consume(discordId, username, selectedModel);
    creditsCharged = true;

    // AI応答生成
    const result = await routeToLLM(
      prompt,
      selectedModel,
      messages,
      channelId,
      memoryContext || undefined,
      undefined  // guildId は LINE にはないので undefined
    );

    // 会話履歴保存
    await lineConversationHistory.append(channelId, user.id, 'user', prompt);
    await lineConversationHistory.append(channelId, user.id, 'assistant', result);

    // LINE に返信（最大4500文字まで）
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

    // エラー時もLINEに返信
    try {
      const token = getLineToken();
      const errMsg = error instanceof Error ? error.message : 'エラーが発生しました。しばらくしてから再度お試しください。';
      await replyMessage(token, event.replyToken, `⚠️ ${errMsg}`);
    } catch (replyErr) {
      console.error('[LINE] Failed to send error reply:', replyErr);
    }
  }
}

export async function handleLineWebhook(body: LineWebhookBody): Promise<void> {
  // 全イベントを並行処理
  await Promise.allSettled(
    body.events.map((event) => handleLineMessage(event))
  );
}


---
=== TASK 2: server.ts に LINE Webhookエンドポイント追加 ===

src/server.ts を編集。
先頭のimport部分（既存のlstep/elme/utage/lmessageのimportの近く）に追加:
import { handleLineWebhook, LineWebhookBody } from './handlers/lineHandler';

既存のWebhookエンドポイント群（/webhook/lstep 等）の直後に追加:

// LINE Messaging API Webhook受信
if (method === 'POST' && url.pathname === '/webhook/line') {
  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      // LINE署名検証（X-Line-Signatureヘッダー）
      // 本番ではHMAC-SHA256検証推奨。今は簡易実装でスキップ
      const parsed = JSON.parse(body) as LineWebhookBody;
      await handleLineWebhook(parsed);
    } catch (err) {
      console.error('[LINE Webhook] error:', err);
    }
    // LINEは常に200を返す必要がある
    sendJson(res, 200, { ok: true });
  });
  return;
}


---
=== TASK 3: .env.example に LINE設定を追記 ===

~/aude/.env に以下の行を追加（既存の内容は変更しない。末尾に追記）:
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret


---
=== TASK 4: README的なコメントをlineHandler.tsに追加 ===

lineHandler.ts の先頭コメントに以下を追記（コードの上にコメントとして記述）:
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


---
注意事項:
- npm installは不要
- TypeScript型エラーなし（strict mode）
- git commitは不要（wrapper scriptが行う）
- server.tsは追記のみ、既存コードを壊さないこと
- lineHandler.tsはsrc/handlers/ディレクトリに作成
