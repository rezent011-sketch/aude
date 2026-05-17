import { DiscordAPIError } from 'discord.js';

const DEFAULT_ERROR_MESSAGE =
  '❌ Something went wrong while processing your request. Please try again.';

type InteractionErrorResponder = {
  replied: boolean;
  deferred: boolean;
  reply(options: { content: string; ephemeral: boolean }): Promise<unknown>;
  followUp(options: { content: string; ephemeral: boolean }): Promise<unknown>;
};

type MessageErrorResponder = {
  reply(content: string): Promise<unknown>;
};

function isDiscordApiError(error: unknown): error is DiscordAPIError {
  return error instanceof DiscordAPIError;
}

export function getUserFriendlyErrorMessage(error: unknown): string {
  if (!isDiscordApiError(error)) {
    return DEFAULT_ERROR_MESSAGE;
  }

  if (error.status === 429) {
    return '⏳ Discord is rate limiting requests right now. Please wait a moment and try again.';
  }

  if (error.code === 50013) {
    return '🔒 I do not have permission to do that in this Discord channel. Please check my role permissions and try again.';
  }

  if (error.code === 10062 || error.code === 40060) {
    return '⌛ This Discord interaction has expired. Please run the command again.';
  }

  if (error.code === 50035) {
    return '✏️ Discord rejected the message format. Please shorten the input and try again.';
  }

  if (error.code === 10008) {
    return '🗑️ The original Discord message is no longer available. Please try again.';
  }

  if (error.status >= 500) {
    return '🚨 Discord is having trouble right now. Please try again in a moment.';
  }

  return DEFAULT_ERROR_MESSAGE;
}

export async function replyToInteractionWithError(
  interaction: InteractionErrorResponder,
  error: unknown
): Promise<void> {
  const content = getUserFriendlyErrorMessage(error);

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true });
      return;
    }

    await interaction.reply({ content, ephemeral: true });
  } catch (replyError) {
    console.error('Failed to send interaction error reply:', replyError);
  }
}

export async function replyToMessageWithError(
  message: MessageErrorResponder,
  error: unknown
): Promise<void> {
  const content = getUserFriendlyErrorMessage(error);

  try {
    await message.reply(content);
  } catch (replyError) {
    console.error('Failed to send message error reply:', replyError);
  }
}
