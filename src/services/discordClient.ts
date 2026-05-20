import { Client } from 'discord.js';
import { splitMessage } from '../utils/discord';

type SendableChannel = {
  send(content: string): Promise<unknown>;
};

function isTextChannel(channel: unknown): channel is SendableChannel {
  return Boolean(
    channel &&
      typeof channel === 'object' &&
      'isTextBased' in channel &&
      typeof channel.isTextBased === 'function' &&
      channel.isTextBased() &&
      'send' in channel &&
      typeof channel.send === 'function'
  );
}

let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
  discordClient = client;
}

export function getDiscordClient(): Client | null {
  return discordClient;
}

export async function sendDiscordMessage(channelId: string, message: string): Promise<void> {
  if (!discordClient) {
    throw new Error('Discord client is not initialized');
  }

  const channel = await discordClient.channels.fetch(channelId);
  if (!isTextChannel(channel)) {
    throw new Error(`Channel ${channelId} is not a text channel`);
  }

  const parts = splitMessage(message, 1900);
  for (const part of parts) {
    await channel.send(part);
  }
}
