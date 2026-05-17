import {
  getRecentMessagesByChannel,
  saveMessage,
  trimMessagesByChannel,
} from '../db/conversationRepository';

export type ConversationRole = 'user' | 'assistant';

export interface ConversationMessage {
  role: ConversationRole;
  content: string;
}

export class ConversationHistory {
  private readonly cache = new Map<string, ConversationMessage[]>();

  constructor(private readonly limit = 10) {}

  async getRecent(channelId: string): Promise<ConversationMessage[]> {
    const cached = this.cache.get(channelId);
    if (cached) {
      return [...cached];
    }

    const records = await getRecentMessagesByChannel(channelId, this.limit);
    const messages = records
      .slice()
      .reverse()
      .map((record) => ({
        role: record.role as ConversationRole,
        content: record.content,
      }));

    this.cache.set(channelId, messages);
    return [...messages];
  }

  async append(
    channelId: string,
    userId: number,
    role: ConversationRole,
    content: string
  ): Promise<void> {
    const current = await this.getRecent(channelId);
    const next = [...current, { role, content }].slice(-this.limit);

    this.cache.set(channelId, next);
    await saveMessage(userId, channelId, role, content);
    await trimMessagesByChannel(channelId, this.limit);
  }
}

export const conversationHistory = new ConversationHistory(10);
