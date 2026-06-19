jest.mock('discord.js', () => {
  class Client {}
  class TextChannel {
    send = jest.fn();
  }

  return { Client, TextChannel };
});

import { IntegrationError } from '../../integrations/errors';
import { TextChannel } from 'discord.js';
import * as utage from '../../integrations/utage';

describe('utage', () => {
  it('parses webhook payload on success', () => {
    expect(
      utage.parseUtageWebhook({
        event: 'email_registered',
        userId: 'user-1',
        displayName: 'Alice',
        email: 'alice@example.com',
        timestamp: 1710000000000,
      })
    ).toEqual({
      event: 'email_registered',
      userId: 'user-1',
      displayName: 'Alice',
      email: 'alice@example.com',
      phone: undefined,
      stepName: undefined,
      amount: undefined,
      timestamp: 1710000000000,
    });
  });

  it('throws when required fields missing', () => {
    expect(() => utage.parseUtageWebhook({ event: 'line_follow' })).toThrow(IntegrationError);
  });

  it('forwards event to discord channel', async () => {
    const channel = Object.create(TextChannel.prototype) as TextChannel & { send: jest.Mock };
    channel.send = jest.fn().mockResolvedValue(undefined);
    const discordClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue(channel),
      },
    };

    await expect(
      utage.forwardUtageToDiscord(
        discordClient as never,
        'channel-1',
        { event: 'line_follow', userId: 'user-1', timestamp: 1710000000000 }
      )
    ).resolves.toBeUndefined();

    expect(channel.send).toHaveBeenCalledWith('👤 [Utage] LINE新規登録: user-1 (user-1)');
  });
});
