import db from './index';

export interface MessageRecord {
  id: number;
  userId: number;
  discordChannelId: string;
  role: string;
  content: string;
  createdAt: string;
}

const getRecentMessagesByChannelStatement = db.prepare(`
  SELECT *
  FROM conversations
  WHERE discordChannelId = ?
  ORDER BY id DESC
  LIMIT ?
`);

const insertMessageStatement = db.prepare(`
  INSERT INTO conversations (userId, discordChannelId, role, content)
  VALUES (?, ?, ?, ?)
`);

const trimMessagesByChannelStatement = db.prepare(`
  DELETE FROM conversations
  WHERE discordChannelId = ?
    AND id NOT IN (
      SELECT id
      FROM conversations
      WHERE discordChannelId = ?
      ORDER BY id DESC
      LIMIT ?
    )
`);

export async function getRecentMessagesByChannel(
  channelId: string,
  limit = 10
): Promise<MessageRecord[]> {
  return getRecentMessagesByChannelStatement.all(channelId, limit) as MessageRecord[];
}

export async function saveMessage(
  userId: number,
  channelId: string,
  role: string,
  content: string
): Promise<void> {
  insertMessageStatement.run(userId, channelId, role, content);
}

export async function trimMessagesByChannel(channelId: string, limit = 10): Promise<void> {
  trimMessagesByChannelStatement.run(channelId, channelId, limit);
}
