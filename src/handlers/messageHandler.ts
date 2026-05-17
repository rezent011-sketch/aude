// src/handlers/messageHandler.ts -- Handle DM and mention messages
import { Message, TextBasedChannel } from 'discord.js';
import { routeToLLM } from '../llm/router';
import { splitMessage } from '../utils/discord';

export async function handleMessage(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  const isDM = message.channel.isDMBased();
  const isMentioned = message.mentions.has(message.client.user!);

  // Respond to DMs (no mention needed) or server mentions
  if (!isDM && !isMentioned) return;

  // Extract content (remove mention from server messages)
  let content = message.content;
  if (isMentioned && message.client.user) {
    content = content
      .replace(`<@${message.client.user.id}>`, '')
      .replace(`<@!${message.client.user.id}>`, '')
      .trim();
  }

  if (!content) {
    await message.reply(
      "Hi! I'm **Aude**, your AI coworker. Tell me what you need and I'll get it done.\n\n" +
      "Try: `research the top 5 AI tools this month` or use `/task` for slash commands."
    );
    return;
  }

  // Show typing indicator (only on channels that support it)
  const channel = message.channel as TextBasedChannel;
  if ('sendTyping' in channel) {
    await (channel as any).sendTyping();
  }

  try {
    const response = await routeToLLM(content, 'auto');
    const parts = splitMessage(response);

      await message.reply(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      if ('send' in message.channel) {
        await (message.channel as any).send(parts[i]);
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await message.reply('Failed to process your request. Please try again.');
  }
}
