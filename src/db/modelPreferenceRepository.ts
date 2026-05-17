import db from './index';

type PersistedModelChoice = 'auto' | 'claude' | 'gpt4o';

export interface ModelPreferenceRecord {
  id: number;
  channel_id: string;
  model: PersistedModelChoice;
  updated_by_discord_id: string;
  updated_by_username: string;
  updated_at: string;
}

class ModelPreferenceRepository {
  private getByChannelStatement = db.prepare(`
    SELECT *
    FROM model_preferences
    WHERE channel_id = ?
  `);

  private upsertStatement = db.prepare(`
    INSERT INTO model_preferences (
      channel_id,
      model,
      updated_by_discord_id,
      updated_by_username
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(channel_id) DO UPDATE SET
      model = excluded.model,
      updated_by_discord_id = excluded.updated_by_discord_id,
      updated_by_username = excluded.updated_by_username
  `);

  getByChannelId(channelId: string): ModelPreferenceRecord | null {
    return (this.getByChannelStatement.get(channelId) as ModelPreferenceRecord | undefined) ?? null;
  }

  setChannelPreference(
    channelId: string,
    model: PersistedModelChoice,
    updatedByDiscordId: string,
    updatedByUsername: string
  ): ModelPreferenceRecord {
    this.upsertStatement.run(channelId, model, updatedByDiscordId, updatedByUsername);
    const updated = this.getByChannelId(channelId);

    if (!updated) {
      throw new Error(`Failed to persist model preference for channel ${channelId}`);
    }

    return updated;
  }
}

export default new ModelPreferenceRepository();
