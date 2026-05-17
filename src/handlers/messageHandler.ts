import { Message, Client } from 'discord.js';
import { routeToLLM } from '../llm/router';

export async function handleMessage(message: Message, client: Client): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  const isDM = message.channel.isDMBased();
  const isMentioned = client.user ? message.mentions.has(client.user) : false;

  // Respond to DMs (no mention needed) or server mentions
  if (!isDM && !isMentioned) return;

  // Clean up the message content (remove user + role mentions)
  const rawContent = message.content;
  const content = rawContent
    .replace(/<@!?\d+>/g, '')   // user mentions
    .replace(/<@&\d+>/g, '')    // role mentions
    .trim();

  console.log(`[MSG] raw="${rawContent}" content="${content}" isDM=${isDM} isMentioned=${isMentioned}`);

  if (!content) {
    await message.reply("Hi! I'm **Aude** 👋 How can I help you today? Try: `@Aude 競合を調査して`");
    return;
  }

  // Show typing indicator
  if ('sendTyping' in message.channel) {
    await (message.channel as any).sendTyping();
  }

  try {
    const result = await routeToLLM(
      `You are Aude, an autonomous AI coworker in Discord. Complete real work — research, coding, writing, analysis. Deliver finished results, not suggestions. Be concise. Reply in the same language the user uses.\n\nUser: ${content}`
    );

    await message.reply(result.slice(0, 1900));
  } catch (err) {
    console.error('Error in handleMessage:', err);
    await message.reply('❌ Something went wrong. Please try again.');
  }
}
