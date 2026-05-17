import db from './index';

export interface Message {
  id: number;
  userId: number;
  discordChannelId: string;
  role: string;
  content: string;
  createdAt: string;
}

export const getRecentMessages = async (userId: number, channelId: string, limit: number = 10): Promise<Message[]> => {
  return db.prepare('SELECT * FROM conversations WHERE userId = ? AND discordChannelId = ? ORDER BY createdAt DESC LIMIT ?').all(userId, channelId, limit);
};


export const saveMessage = async (userId: number, channelId: string, role: string, content: string): Promise<void> => {
  db.prepare('INSERT INTO conversations (userId, discordChannelId, role, content) VALUES (?, ?, ?, ?)').run(userId, channelId, role, content);
};

