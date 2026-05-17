import { DiscordAPIError } from 'discord.js';
import {
  getUserFriendlyErrorMessage,
  replyToInteractionWithError,
  replyToMessageWithError,
} from '../utils/errorHandler';

function createDiscordApiError(code: number, status: number, message = 'Discord error') {
  return new DiscordAPIError(
    { code, message },
    code,
    status,
    'POST',
    '/interactions/test',
    {}
  );
}

describe('getUserFriendlyErrorMessage', () => {
  it('maps missing permissions to a user-friendly message', () => {
    const error = createDiscordApiError(50013, 403, 'Missing Permissions');

    expect(getUserFriendlyErrorMessage(error)).toContain('permission');
  });

  it('maps expired interactions to a retry message', () => {
    const error = createDiscordApiError(10062, 404, 'Unknown interaction');

    expect(getUserFriendlyErrorMessage(error)).toContain('run the command again');
  });

  it('maps rate limits to a wait message', () => {
    const error = createDiscordApiError(0, 429, 'Rate limited');

    expect(getUserFriendlyErrorMessage(error)).toContain('rate limiting');
  });

  it('falls back to a generic message for non-Discord errors', () => {
    expect(getUserFriendlyErrorMessage(new Error('boom'))).toContain('Something went wrong');
  });
});

describe('replyToInteractionWithError', () => {
  it('replies when the interaction has not been acknowledged yet', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const followUp = jest.fn().mockResolvedValue(undefined);

    await replyToInteractionWithError(
      {
        replied: false,
        deferred: false,
        reply,
        followUp,
      },
      createDiscordApiError(50035, 400, 'Invalid Form Body')
    );

    expect(reply).toHaveBeenCalledWith({
      content: expect.stringContaining('message format'),
      ephemeral: true,
    });
    expect(followUp).not.toHaveBeenCalled();
  });

  it('uses followUp after the interaction has already been deferred', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const followUp = jest.fn().mockResolvedValue(undefined);

    await replyToInteractionWithError(
      {
        replied: false,
        deferred: true,
        reply,
        followUp,
      },
      createDiscordApiError(50013, 403, 'Missing Permissions')
    );

    expect(followUp).toHaveBeenCalledWith({
      content: expect.stringContaining('permission'),
      ephemeral: true,
    });
    expect(reply).not.toHaveBeenCalled();
  });
});

describe('replyToMessageWithError', () => {
  it('replies with the mapped error message', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);

    await replyToMessageWithError(
      {
        reply,
      },
      createDiscordApiError(10008, 404, 'Unknown Message')
    );

    expect(reply).toHaveBeenCalledWith(expect.stringContaining('no longer available'));
  });
});
