// src/db/memoryRepository.ts
// Week13: AIメモリシステム - DBアクセス層

import db from './index';

export type MemoryType = 'preference' | 'fact' | 'skill' | 'context';
export type MemorySource = 'auto' | 'manual';

export interface UserMemory {
  id: number;
  discord_id: string;
  memory_type: MemoryType;
  content: string;
  source: MemorySource;
  importance: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoryParams {
  discord_id: string;
  memory_type: MemoryType;
  content: string;
  source?: MemorySource;
  importance?: number;
}

export const MemoryRepository = {
  /** ユーザーの全メモリを取得（重要度降順） */
  findByDiscordId(discordId: string): UserMemory[] {
    return db
      .prepare(
        `SELECT * FROM user_memories
         WHERE discord_id = ?
         ORDER BY importance DESC, updated_at DESC`
      )
      .all(discordId) as UserMemory[];
  },

  /** 重要度が高いメモリをN件取得（AIコンテキスト注入用） */
  findTopByDiscordId(discordId: string, limit = 10): UserMemory[] {
    return db
      .prepare(
        `SELECT * FROM user_memories
         WHERE discord_id = ?
         ORDER BY importance DESC, updated_at DESC
         LIMIT ?`
      )
      .all(discordId, limit) as UserMemory[];
  },

  /** メモリ作成 */
  create(params: CreateMemoryParams): UserMemory {
    const { discord_id, memory_type, content, source = 'auto', importance = 1 } = params;
    const result = db
      .prepare(
        `INSERT INTO user_memories (discord_id, memory_type, content, source, importance)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(discord_id, memory_type, content, source, importance);

    return db
      .prepare('SELECT * FROM user_memories WHERE id = ?')
      .get(result.lastInsertRowid) as UserMemory;
  },

  /** メモリ削除（本人のみ） */
  deleteById(id: number, discordId: string): boolean {
    const result = db
      .prepare('DELETE FROM user_memories WHERE id = ? AND discord_id = ?')
      .run(id, discordId);
    return result.changes > 0;
  },

  /** ユーザーの全メモリを削除 */
  deleteAllByDiscordId(discordId: string): number {
    const result = db
      .prepare('DELETE FROM user_memories WHERE discord_id = ?')
      .run(discordId);
    return result.changes;
  },

  /** メモリ件数を取得 */
  countByDiscordId(discordId: string): number {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM user_memories WHERE discord_id = ?')
      .get(discordId) as { count: number };
    return row.count;
  },

  /** 重複チェック（同じcontentが既にあるか） */
  existsSimilar(discordId: string, content: string): boolean {
    const row = db
      .prepare(
        `SELECT COUNT(*) as count FROM user_memories
         WHERE discord_id = ? AND content = ?`
      )
      .get(discordId, content) as { count: number };
    return row.count > 0;
  },
};

export default MemoryRepository;
