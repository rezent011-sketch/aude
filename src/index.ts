import { Client, Collection, GatewayIntentBits, Interaction, Partials } from 'discord.js';
import 'dotenv/config';
import { loadCommands } from './handlers/commandHandler';
import { handleInteraction } from './handlers/interactionHandler';
import { handleMessage } from './handlers/messageHandler';
import { startApiServer } from './server';
import approvalService from './services/approvalService';
import scheduleService from './services/scheduleService';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User],
});

// Attach a commands collection to the client
(client as any).commands = new Collection();

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  // Load commands into the in-memory collection
  await loadCommands(client);
  await approvalService.initialize(client);
  await scheduleService.initialize(client);
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

startApiServer();
client.login(process.env.DISCORD_TOKEN);
