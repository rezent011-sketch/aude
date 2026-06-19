jest.mock('discord.js', () => {
  class MockTextChannel {
    send = jest.fn().mockResolvedValue(undefined);
  }

  return {
    Client: class MockClient {},
    TextChannel: MockTextChannel,
  };
});

import { TextChannel } from 'discord.js';
import { IntegrationError } from '../../integrations/errors';
import * as elme from '../../integrations/elme';

describe('elme', () => {
  it('parses webhook payload and forwards it to Discord', async () => {
    const event = elme.parseElmeWebhook({
      event: 'follow',
      userId: 'user-1',
      displayName: 'Alice',
      timestamp: 1,
    });
    const channel = new (TextChannel as unknown as { new (): { send: jest.Mock } })();
    const discordClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue(channel),
      },
    } as any;

    await elme.forwardElmeToDiscord(discordClient, 'channel-1', event);

    expect(channel.send).toHaveBeenCalled();
  });

  it('throws on invalid payload', () => {
    expect(() => elme.parseElmeWebhook({})).toThrow(IntegrationError);
  });

  it('formats message events', () => {
    expect(
      elme.formatElmeEventMessage({ event: 'message', userId: 'u1', displayName: 'Alice', message: 'hello', timestamp: 1 })
    ).toContain('hello');
  });
});
