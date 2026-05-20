import { Client, Message } from 'discord.js';
import { conversationHistory } from '../conversation/history';
import {
  INSUFFICIENT_CREDITS_MESSAGE,
  InsufficientCreditsError,
  creditsChecker,
} from '../credits/checker';
import { creditsManager } from '../credits/manager';
import UserRepository from '../db/userRepository';
import GuildRepository from '../db/guildRepository';
import { ModelChoice, resolveModelChoice, routeToLLM } from '../llm/router';
import { replyToMessageWithError } from '../utils/errorHandler';
import { buildMemoryContext, extractMemoriesFromConversation } from '../services/memoryService';

export async function handleMessage(message: Message, client: Client): Promise<void> {
  if (message.author.bot) {
    return;
  }

  const isDM = message.channel.isDMBased();
  const isMentioned = client.user ? message.mentions.has(client.user) : false;

  if (!isDM && !isMentioned) {
    return;
  }

  const prompt = message.content.trim();
  if (!prompt) {
    return;
  }

  const discordId = message.author.id;
  const username = message.author.username;
  const channelId = message.channel.id;
  const guildId = message.guild?.id ?? null;
  const user = UserRepository.getOrCreateUser(discordId, username);

  // ギルド設定のデフォルトモデルをフォールバックとして使用
  let guildDefaultModel: ModelChoice = 'auto';
  if (guildId) {
    const guildSettings = GuildRepository.getByGuildId(guildId);
    if (guildSettings && guildSettings.default_model !== 'auto') {
      guildDefaultModel = guildSettings.default_model as ModelChoice;
    }
  }

  const selectedModel = resolveModelChoice(prompt, guildDefaultModel, channelId);

  console.log(
    `[MSG] channelId=${channelId} discordId=${discordId} model=${selectedModel}`
  );

  let creditsCharged = false;

  try {
    creditsChecker.ensureSufficientCredits(discordId, username, selectedModel);

    const history = await conversationHistory.getRecent(channelId);
    const messages = [...history, { role: 'user' as const, content: prompt }];

    // Week13: メモリコンテキストをAIに注入
    const memoryContext = buildMemoryContext(discordId);

    // ユーザー発言からメモリを自動抽出（バックグラウンド処理）
    try {
      extractMemoriesFromConversation(discordId, prompt);
    } catch (memErr) {
      console.warn('[Memory] Auto-extract failed:', memErr);
    }

    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    creditsManager.consume(discordId, username, selectedModel);
    creditsCharged = true;

    const result = await routeToLLM(prompt, selectedModel, messages, channelId, memoryContext || undefined);

    await conversationHistory.append(channelId, user.id, 'user', prompt);
    await conversationHistory.append(channelId, user.id, 'assistant', result);

    await message.reply(result.slice(0, 1900));
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      await message.reply(INSUFFICIENT_CREDITS_MESSAGE);
      return;
    }

    console.error('Error in handleMessage:', error);

    if (creditsCharged) {
      try {
        creditsManager.refund(discordId, username, selectedModel, 'LLM call failed');
      } catch (refundError) {
        console.error('Failed to refund credits:', refundError);
      }
    }

    await replyToMessageWithError(message, error);
  }
}
