// src/utils/discord.ts -- Discord utility functions
export const DISCORD_MAX_LENGTH = 2000;

/**
 * Split a long message into Discord-safe chunks (max 2000 chars each)
 */
export function splitMessage(text: string, maxLength = DISCORD_MAX_LENGTH): string[] {
  if (text.length <= maxLength) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt <= 0) {
      // Fall back to splitting at a space
      splitAt = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitAt <= 0) {
      // Hard split
      splitAt = maxLength;
    }

    parts.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return parts;
}

/**
 * Format elapsed time in a human-readable way
 */
export function formatElapsed(startTime: number): string {
  const ms = Date.now() - startTime;
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Truncate text with ellipsis if too long
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
