import db from './index';

export interface ScheduleRecord {
  id: number;
  userId: number;
  guildId: string;
  channelId: string;
  cronExpr: string;
  task: string;
  isActive: boolean;
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
}

interface ScheduleRow {
  id: number;
  user_id: number;
  guild_id: string;
  channel_id: string;
  cron_expr: string;
  task: string;
  is_active: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

export interface CreateScheduleInput {
  userId: number;
  guildId: string;
  channelId: string;
  cronExpr: string;
  task: string;
  isActive?: boolean;
  nextRun?: string | null;
}

function mapSchedule(row: ScheduleRow | undefined): ScheduleRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    cronExpr: row.cron_expr,
    task: row.task,
    isActive: row.is_active === 1,
    lastRun: row.last_run,
    nextRun: row.next_run,
    createdAt: row.created_at,
  };
}

class ScheduleRepository {
  private insertStatement = db.prepare(`
    INSERT INTO schedules (user_id, guild_id, channel_id, cron_expr, task, is_active, next_run)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  private getByIdStatement = db.prepare(`
    SELECT *
    FROM schedules
    WHERE id = ?
  `);
  private getByIdForUserStatement = db.prepare(`
    SELECT *
    FROM schedules
    WHERE id = ?
      AND user_id = ?
      AND guild_id = ?
  `);
  private listByUserStatement = db.prepare(`
    SELECT *
    FROM schedules
    WHERE user_id = ?
      AND guild_id = ?
    ORDER BY id ASC
  `);
  private listActiveStatement = db.prepare(`
    SELECT *
    FROM schedules
    WHERE is_active = 1
    ORDER BY id ASC
  `);
  private updateStatusStatement = db.prepare(`
    UPDATE schedules
    SET is_active = ?,
        next_run = ?
    WHERE id = ?
  `);
  private updateExecutionStateStatement = db.prepare(`
    UPDATE schedules
    SET last_run = ?,
        next_run = ?
    WHERE id = ?
  `);
  private deleteStatement = db.prepare(`
    DELETE FROM schedules
    WHERE id = ?
  `);

  create(input: CreateScheduleInput): ScheduleRecord {
    const info = this.insertStatement.run(
      input.userId,
      input.guildId,
      input.channelId,
      input.cronExpr,
      input.task,
      input.isActive === false ? 0 : 1,
      input.nextRun ?? null
    );

    const created = this.getById(Number(info.lastInsertRowid));
    if (!created) {
      throw new Error('スケジュールの保存に失敗しました。');
    }

    return created;
  }

  getById(id: number): ScheduleRecord | null {
    return mapSchedule(this.getByIdStatement.get(id) as ScheduleRow | undefined);
  }

  getByIdForUser(id: number, userId: number, guildId: string): ScheduleRecord | null {
    return mapSchedule(
      this.getByIdForUserStatement.get(id, userId, guildId) as ScheduleRow | undefined
    );
  }

  listByUser(userId: number, guildId: string): ScheduleRecord[] {
    const rows = this.listByUserStatement.all(userId, guildId) as ScheduleRow[];
    return rows
      .map((row) => mapSchedule(row))
      .filter((row): row is ScheduleRecord => row !== null);
  }

  listActive(): ScheduleRecord[] {
    const rows = this.listActiveStatement.all() as ScheduleRow[];
    return rows
      .map((row) => mapSchedule(row))
      .filter((row): row is ScheduleRecord => row !== null);
  }

  updateStatus(id: number, isActive: boolean, nextRun: string | null): void {
    this.updateStatusStatement.run(isActive ? 1 : 0, nextRun, id);
  }

  updateExecutionState(id: number, lastRun: string | null, nextRun: string | null): void {
    this.updateExecutionStateStatement.run(lastRun, nextRun, id);
  }

  delete(id: number): void {
    this.deleteStatement.run(id);
  }
}

export default new ScheduleRepository();
