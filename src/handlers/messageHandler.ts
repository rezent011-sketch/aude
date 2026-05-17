import { Message, Client } from 'discord.js';
import { routeToLLM } from '../llm/router';
import { getRecentMessages, saveMessage } from '../db/conversationRepository';

export async function handleMessage(message: Message, client: Client): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  const isDM = message.channel.isDMBased();
  const isMentioned = client.user ? message.mentions.has(client.user) : false;

  // Respond to DMs (no mention needed) or server mentions
  if (!isDM && !isMentioned) return;

  const userId = message.author.id;
  const channelId = message.channel.id;

  // Fetch the last 10 messages for context
  const history = await getRecentMessages(userId, channelId);

  // Format messages for the LLM
  const messages = history.map((msg) => ({ role: msg.role, content: msg.content }));

  // Append the current message
  messages.push({ role: 'user', content: message.content.trim() });

  console.log(`[MSG] Fetching history and processing message with userId=${userId} channelId=${channelId}`);

  if ('sendTyping' in message.channel) {
    await (message.channel as any).sendTyping();
  }

  try {
    // Pass message history to the LLM
    const result = await routeToLLM(message.content, 'auto', messages);

    // Save current interaction
    await saveMessage(userId, channelId, 'user', message.content);
    await saveMessage(userId, channelId, 'assistant', result);

    await message.reply(result.slice(0, 1900));
  } catch (err) {
    console.error('Error in handleMessage:', err);
    await message.reply('❌ Something went wrong. Please try again.');
  }
}
