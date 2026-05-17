import dotenv from 'dotenv';
dotenv.config();

export const loadConfig = () => {
  const { DISCORD_TOKEN, ANTHROPIC_API_KEY, BOT_PREFIX } = process.env;
  if (!DISCORD_TOKEN || !ANTHROPIC_API_KEY || !BOT_PREFIX) {
    throw new Error('Missing environment variables');
  }
  return { DISCORD_TOKEN, ANTHROPIC_API_KEY, BOT_PREFIX };
};
