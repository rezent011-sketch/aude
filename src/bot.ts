import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.DirectMessages,
] });

client.once('ready', () => {
  console.log('Bot is ready!');
});

client.login(process.env.DISCORD_TOKEN);
