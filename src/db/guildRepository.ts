import db from './index';

export type GuildModelChoice = 'auto' | 'claude' | 'gpt4o';

export interface GuildSettings {
  guild_id: string;
  guild_name: string;
  prefix: string;
  default_model: GuildModelChoice;
  admin_role_id: string | null;
  welcome_channel_id: string | null;
  max_credits_per_user: number;
  created_at: string;
  updated_at: string;
}

const ALLOWED_KEYS: Array<keyof GuildSettings> = [
  'guild_name',
  'prefix',
  'default_model',
  'admin_role_id',
  'welcome_channel_id',
  'max_credits_per_user',
];

class GuildRepository {
  private getByIdStatement = db.prepare(`
    SELECT * FROM guild_settings WHERE guild_id = ?
  `);

  private insertStatement = db.prepare(`
    INSERT INTO guild_settings (guild_id, guild_name)
    VALUES (?, ?)
  `);

  private listAllStatement = db.prepare(`
    SELECT * FROM guild_settings ORDER BY created_at DESC
  `);

  getByGuildId(guildId: string): GuildSettings | null {
    return (this.getByIdStatement.get(guildId) as GuildSettings | undefined) ?? null;
  }

  getOrCreate(guildId: string, guildName: string): GuildSettings {
    const existing = this.getByGuildId(guildId);
    if (existing) {
      // guild_nameが変わっていたら更新
      if (existing.guild_name !== guildName) {
        this.updateSetting(guildId, 'guild_name', guildName);
      }
      return this.getByGuildId(guildId)!;
    }
    this.insertStatement.run(guildId, guildName);
    return this.getByGuildId(guildId)!;
  }

  updateSetting(
    guildId: string,
    key: keyof Omit<GuildSettings, 'guild_id' | 'created_at' | 'updated_at'>,
    value: string | number | null
  ): GuildSettings {
    if (!ALLOWED_KEYS.includes(key as keyof GuildSettings)) {
      throw new Error(`Invalid setting key: ${key}`);
    }
    const stmt = db.prepare(`
      UPDATE guild_settings
      SET ${key} = ?, updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ?
    `);
    stmt.run(value, guildId);
    return this.getByGuildId(guildId)!;
  }

  resetToDefaults(guildId: string): GuildSettings {
    const stmt = db.prepare(`
      UPDATE guild_settings
      SET prefix = '!',
          default_model = 'auto',
          admin_role_id = NULL,
          welcome_channel_id = NULL,
          max_credits_per_user = 100,
          updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = ?
    `);
    stmt.run(guildId);
    return this.getByGuildId(guildId)!;
  }

  listAll(): GuildSettings[] {
    return this.listAllStatement.all() as GuildSettings[];
  }
}

export default new GuildRepository();
