jest.mock('discord.js', () => {
  class TextChannel {
    send = jest.fn();
  }
  return { Client: jest.fn(), TextChannel };
});

import { TextChannel } from 'discord.js';
import { IntegrationError } from '../../integrations/errors';
import * as lmessage from '../../integrations/lmessage';

describe('lmessage', () => {
  it('parses webhook payload', () => {
    expect(lmessage.parseLmessageWebhook({ event: 'follow', userId: 'u1', timestamp: 1 })).toEqual(
      expect.objectContaining({ event: 'follow', userId: 'u1', timestamp: 1 })
    );
  });

  it('throws on invalid webhook payload', () => {
    expect(() => lmessage.parseLmessageWebhook({ userId: 'u1' })).toThrow(IntegrationError);
  });

  it('forwards message to discord', async () => {
    const channel = Object.create(TextChannel.prototype) as { send: jest.Mock };
    channel.send = jest.fn();
    const client = { channels: { fetch: jest.fn().mockResolvedValue(channel) } } as any;

    await lmessage.forwardLmessageToDiscord(client, '123', { event: 'message', userId: 'u1', message: 'hello', timestamp: 1 });
    expect(channel.send).toHaveBeenCalledWith(expect.stringContaining('hello'));
  });
});
