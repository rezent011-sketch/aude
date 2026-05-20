// src/db/pluginRepository.ts
// カスタムプラグイン（サーバーごとのカスタムコマンド・応答）管理

import db from './index';

export interface Plugin {
  id: number;
  guild_id: string;
  name: string;           // コマンド名 (例: "welcome", "rules")
  trigger: string;        // トリガー文字列 (スラッシュコマンド名 or キーワード)
  trigger_type: 'command' | 'keyword';
  response: string;       // 応答テキスト (変数: {{user}}, {{server}})
  is_active: number;      // 0 or 1
  created_by_discord_id: string;
  created_by_username: string;
  created_at: string;
  updated_at: string;
}

// テーブル作成はdb/index.tsで行うため、ここでは型とCRUDのみ定義

class PluginRepository {
  private listByGuildStatement = db.prepare(`
    SELECT * FROM plugins WHERE guild_id = ? ORDER BY created_at DESC
  `);

  private getByNameStatement = db.prepare(`
    SELECT * FROM plugins WHERE guild_id = ? AND name = ? LIMIT 1
  `);

  private getByIdStatement = db.prepare(`
    SELECT * FROM plugins WHERE id = ? AND guild_id = ?
  `);

  private insertStatement = db.prepare(`
    INSERT INTO plugins (guild_id, name, trigger, trigger_type, response, created_by_discord_id, created_by_username)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  private updateStatement = db.prepare(`
    UPDATE plugins SET trigger = ?, trigger_type = ?, response = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND guild_id = ?
  `);

  private deleteStatement = db.prepare(`
    DELETE FROM plugins WHERE id = ? AND guild_id = ?
  `);

  private toggleStatement = db.prepare(`
    UPDATE plugins SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND guild_id = ?
  `);

  private getActiveKeywordsStatement = db.prepare(`
    SELECT * FROM plugins WHERE guild_id = ? AND trigger_type = 'keyword' AND is_active = 1
  `);

  listByGuild(guildId: string): Plugin[] {
    return this.listByGuildStatement.all(guildId) as Plugin[];
  }

  getByName(guildId: string, name: string): Plugin | null {
    return (this.getByNameStatement.get(guildId, name) as Plugin | undefined) ?? null;
  }

  getById(id: number, guildId: string): Plugin | null {
    return (this.getByIdStatement.get(id, guildId) as Plugin | undefined) ?? null;
  }

  create(
    guildId: string,
    name: string,
    trigger: string,
    triggerType: 'command' | 'keyword',
    response: string,
    createdByDiscordId: string,
    createdByUsername: string
  ): Plugin {
    const result = this.insertStatement.run(
      guildId, name, trigger, triggerType, response, createdByDiscordId, createdByUsername
    );
    return this.getById(result.lastInsertRowid as number, guildId)!;
  }

  update(
    id: number,
    guildId: string,
    trigger: string,
    triggerType: 'command' | 'keyword',
    response: string,
    isActive: boolean
  ): Plugin | null {
    this.updateStatement.run(trigger, triggerType, response, isActive ? 1 : 0, id, guildId);
    return this.getById(id, guildId);
  }

  delete(id: number, guildId: string): boolean {
    const result = this.deleteStatement.run(id, guildId);
    return (result.changes ?? 0) > 0;
  }

  toggle(id: number, guildId: string, active: boolean): Plugin | null {
    this.toggleStatement.run(active ? 1 : 0, id, guildId);
    return this.getById(id, guildId);
  }

  getActiveKeywords(guildId: string): Plugin[] {
    return this.getActiveKeywordsStatement.all(guildId) as Plugin[];
  }
}

export default new PluginRepository();
