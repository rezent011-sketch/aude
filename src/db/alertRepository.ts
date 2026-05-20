import db from './index';

export type AlertType = 'keyword' | 'schedule' | 'threshold' | 'reminder';

export interface Alert {
  id: number;
  guildId: string;
  channelId: string;
  createdBy: string;
  alertType: AlertType;
  name: string;
  condition: string;
  cronExpr: string | null;
  message: string;
  isActive: boolean;
  lastTriggered: string | null;
  triggerCount: number;
  createdAt: string;
}

interface AlertRow {
  id: number;
  guild_id: string;
  channel_id: string;
  created_by: string;
  alert_type: AlertType;
  name: string;
  condition: string;
  cron_expr: string | null;
  message: string;
  is_active: number;
  last_triggered: string | null;
  trigger_count: number;
  created_at: string;
}

export interface CreateAlertInput {
  guildId: string;
  channelId: string;
  createdBy: string;
  alertType: AlertType;
  name: string;
  condition: string;
  cronExpr: string | null;
  message: string;
  isActive?: boolean;
}

function mapAlert(row: AlertRow | undefined): Alert | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    createdBy: row.created_by,
    alertType: row.alert_type,
    name: row.name,
    condition: row.condition,
    cronExpr: row.cron_expr,
    message: row.message,
    isActive: row.is_active === 1,
    lastTriggered: row.last_triggered,
    triggerCount: row.trigger_count,
    createdAt: row.created_at,
  };
}

class AlertRepository {
  private getByIdStatement = db.prepare(`
    SELECT *
    FROM alerts
    WHERE id = ?
  `);

  private getByIdForGuildStatement = db.prepare(`
    SELECT *
    FROM alerts
    WHERE id = ?
      AND guild_id = ?
  `);

  private findByGuildIdStatement = db.prepare(`
    SELECT *
    FROM alerts
    WHERE guild_id = ?
    ORDER BY id ASC
  `);

  private findActiveAlertsStatement = db.prepare(`
    SELECT *
    FROM alerts
    WHERE is_active = 1
    ORDER BY id ASC
  `);

  private insertStatement = db.prepare(`
    INSERT INTO alerts (
      guild_id,
      channel_id,
      created_by,
      alert_type,
      name,
      condition,
      cron_expr,
      message,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  private setActiveStatement = db.prepare(`
    UPDATE alerts
    SET is_active = ?
    WHERE id = ?
      AND guild_id = ?
  `);

  private deleteStatement = db.prepare(`
    DELETE FROM alerts
    WHERE id = ?
      AND guild_id = ?
  `);

  private recordTriggerStatement = db.prepare(`
    UPDATE alerts
    SET last_triggered = ?,
        trigger_count = trigger_count + 1
    WHERE id = ?
  `);

  findByGuildId(guildId: string): Alert[] {
    const rows = this.findByGuildIdStatement.all(guildId) as AlertRow[];
    return rows
      .map((row) => mapAlert(row))
      .filter((row): row is Alert => row !== null);
  }

  findActiveAlerts(): Alert[] {
    const rows = this.findActiveAlertsStatement.all() as AlertRow[];
    return rows
      .map((row) => mapAlert(row))
      .filter((row): row is Alert => row !== null);
  }

  getById(id: number): Alert | null {
    return mapAlert(this.getByIdStatement.get(id) as AlertRow | undefined);
  }

  getByIdForGuild(id: number, guildId: string): Alert | null {
    return mapAlert(this.getByIdForGuildStatement.get(id, guildId) as AlertRow | undefined);
  }

  create(input: CreateAlertInput): Alert {
    const result = this.insertStatement.run(
      input.guildId,
      input.channelId,
      input.createdBy,
      input.alertType,
      input.name,
      input.condition,
      input.cronExpr,
      input.message,
      input.isActive === false ? 0 : 1
    );

    const created = this.getById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error('アラートの保存に失敗しました。');
    }

    return created;
  }

  setActive(id: number, guildId: string, isActive: boolean): boolean {
    const result = this.setActiveStatement.run(isActive ? 1 : 0, id, guildId);
    return (result.changes ?? 0) > 0;
  }

  delete(id: number, guildId: string): boolean {
    const result = this.deleteStatement.run(id, guildId);
    return (result.changes ?? 0) > 0;
  }

  recordTrigger(id: number, triggeredAt: string): boolean {
    const result = this.recordTriggerStatement.run(triggeredAt, id);
    return (result.changes ?? 0) > 0;
  }
}

export default new AlertRepository();
