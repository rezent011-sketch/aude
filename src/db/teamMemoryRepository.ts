import db from './index';

export type TeamMemoryType = 'fact' | 'rule' | 'context' | 'goal';

export interface TeamMemory {
  id: number;
  guild_id: string;
  added_by: string;
  memory_type: TeamMemoryType;
  content: string;
  importance: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTeamMemoryParams {
  guild_id: string;
  added_by: string;
  memory_type: TeamMemoryType;
  content: string;
  importance?: number;
}

export const TeamMemoryRepository = {
  findByGuildId(guildId: string): TeamMemory[] {
    return db
      .prepare(
        `SELECT * FROM team_memories
         WHERE guild_id = ?
         ORDER BY importance DESC, updated_at DESC`
      )
      .all(guildId) as TeamMemory[];
  },

  findTopByGuildId(guildId: string, limit = 10): TeamMemory[] {
    return db
      .prepare(
        `SELECT * FROM team_memories
         WHERE guild_id = ?
         ORDER BY importance DESC, updated_at DESC
         LIMIT ?`
      )
      .all(guildId, limit) as TeamMemory[];
  },

  create(params: CreateTeamMemoryParams): TeamMemory {
    const { guild_id, added_by, memory_type, content, importance = 5 } = params;
    const result = db
      .prepare(
        `INSERT INTO team_memories (guild_id, added_by, memory_type, content, importance)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(guild_id, added_by, memory_type, content, importance);

    return db
      .prepare('SELECT * FROM team_memories WHERE id = ?')
      .get(result.lastInsertRowid) as TeamMemory;
  },

  deleteById(id: number, guildId: string): boolean {
    const result = db
      .prepare('DELETE FROM team_memories WHERE id = ? AND guild_id = ?')
      .run(id, guildId);
    return result.changes > 0;
  },

  clear(guildId: string): number {
    const result = db
      .prepare('DELETE FROM team_memories WHERE guild_id = ?')
      .run(guildId);
    return result.changes;
  },

  search(guildId: string, query: string): TeamMemory[] {
    return db
      .prepare(
        `SELECT * FROM team_memories
         WHERE guild_id = ? AND content LIKE ?
         ORDER BY importance DESC, updated_at DESC`
      )
      .all(guildId, `%${query}%`) as TeamMemory[];
  },
};

export default TeamMemoryRepository;
