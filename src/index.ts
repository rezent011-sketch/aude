// src/index.ts — Aude Bot entry point
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { loadCommands } from './handlers/commandHandler';
import { handleInteraction } from './handlers/interactionHandler';
import { handleMessage } from './handlers/messageHandler';

// Validate required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Create Discord client with necessary intents
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Channel, // Required for DM support
    Partials.Message,
  ],
});

// Attach commands collection to client
(client as any).commands = new Collection();

async function main() {
  console.log('🤖 Aude is starting up...');

  // Load slash commands
  await loadCommands(client);

  // Register event handlers
  client.once('ready', () => {
    console.log(`✅ Aude is online as ${client.user?.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} server(s)`);
    client.user?.setActivity('your tasks | /task', { type: 3 }); // ActivityType.Watching = 3
  });

  client.on('interactionCreate', handleInteraction);
  client.on('messageCreate', handleMessage);

  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  // Login to Discord
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
