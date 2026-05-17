import { Client, Collection, GatewayIntentBits, Interaction } from 'discord.js';
import 'dotenv/config';
import { loadCommands } from './handlers/commandHandler';
import { handleInteraction } from './handlers/interactionHandler';
import { handleMessage } from './handlers/messageHandler';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: ['CHANNEL', 'MESSAGE'] as any,
});

// Attach a commands collection to the client
(client as any).commands = new Collection();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  // Load commands into the in-memory collection
  await loadCommands(client);
});

// Handle slash commands and button interactions
client.on('interactionCreate', async (interaction: Interaction) => {
  await handleInteraction(interaction);
});

// Handle plain @mention / DM messages
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  await handleMessage(message, client);
});

client.login(process.env.DISCORD_TOKEN);
