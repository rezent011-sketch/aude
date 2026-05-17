import { Client, Message } from 'discord.js';
import { conversationHistory } from '../conversation/history';
import {
  INSUFFICIENT_CREDITS_MESSAGE,
  InsufficientCreditsError,
  creditsChecker,
} from '../credits/checker';
import { creditsManager } from '../credits/manager';
import UserRepository from '../db/userRepository';
import { resolveModelChoice, routeToLLM } from '../llm/router';

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
  const user = UserRepository.getOrCreateUser(discordId, username);
  const selectedModel = resolveModelChoice(prompt, 'auto');

  console.log(
    `[MSG] channelId=${channelId} discordId=${discordId} model=${selectedModel}`
  );

  let creditsCharged = false;

  try {
    creditsChecker.ensureSufficientCredits(discordId, username, selectedModel);

    const history = await conversationHistory.getRecent(channelId);
    const messages = [...history, { role: 'user' as const, content: prompt }];

    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    creditsManager.consume(discordId, username, selectedModel);
    creditsCharged = true;

    const result = await routeToLLM(prompt, selectedModel, messages);

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

    await message.reply('❌ Something went wrong. Please try again.');
  }
}
