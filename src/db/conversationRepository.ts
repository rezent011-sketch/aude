import db from './index';

export interface MessageRecord {
  id: number;
  userId: number;
  discordChannelId: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ExportMessageRecord extends MessageRecord {
  username: string;
}

export interface UserConversationSummary {
  messageCount: number;
  promptCount: number;
  responseCount: number;
  channelCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
}

const getRecentMessagesByChannelStatement = db.prepare(`
  SELECT *
  FROM conversations
  WHERE discordChannelId = ?
  ORDER BY id DESC
  LIMIT ?
`);

const getMessagesByChannelStatement = db.prepare(`
  SELECT c.*, u.username
  FROM conversations c
  INNER JOIN users u ON u.id = c.userId
  WHERE c.discordChannelId = ?
  ORDER BY c.id ASC
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

const getUserConversationSummaryStatement = db.prepare(`
  SELECT
    COUNT(*) AS messageCount,
    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS promptCount,
    SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS responseCount,
    COUNT(DISTINCT discordChannelId) AS channelCount,
    MIN(createdAt) AS firstMessageAt,
    MAX(createdAt) AS lastMessageAt
  FROM conversations
  WHERE userId = ?
`);

export async function getRecentMessagesByChannel(
  channelId: string,
  limit = 10
): Promise<MessageRecord[]> {
  return getRecentMessagesByChannelStatement.all(channelId, limit) as MessageRecord[];
}

export async function getMessagesByChannel(channelId: string): Promise<ExportMessageRecord[]> {
  return getMessagesByChannelStatement.all(channelId) as ExportMessageRecord[];
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

export async function getUserConversationSummary(
  userId: number
): Promise<UserConversationSummary> {
  const summary = getUserConversationSummaryStatement.get(userId) as
    | UserConversationSummary
    | undefined;

  return {
    messageCount: summary?.messageCount ?? 0,
    promptCount: summary?.promptCount ?? 0,
    responseCount: summary?.responseCount ?? 0,
    channelCount: summary?.channelCount ?? 0,
    firstMessageAt: summary?.firstMessageAt ?? null,
    lastMessageAt: summary?.lastMessageAt ?? null,
  };
}
