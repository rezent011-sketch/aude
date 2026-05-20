import db from './index';

export type BackgroundJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BackgroundJob {
  id: number;
  guildId: string | null;
  channelId: string;
  userId: string;
  title: string;
  description: string;
  status: BackgroundJobStatus;
  progress: number;
  progressMessage: string | null;
  result: string | null;
  errorMessage: string | null;
  stepsTotal: number;
  stepsDone: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface BackgroundJobRow {
  id: number;
  guild_id: string | null;
  channel_id: string;
  user_id: string;
  title: string;
  description: string;
  status: BackgroundJobStatus;
  progress: number;
  progress_message: string | null;
  result: string | null;
  error_message: string | null;
  steps_total: number;
  steps_done: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateBackgroundJobInput {
  guildId: string | null;
  channelId: string;
  userId: string;
  title: string;
  description: string;
}

function mapBackgroundJob(row: BackgroundJobRow | undefined): BackgroundJob | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    progress: row.progress,
    progressMessage: row.progress_message,
    result: row.result,
    errorMessage: row.error_message,
    stepsTotal: row.steps_total,
    stepsDone: row.steps_done,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

class JobRepository {
  private insertStatement = db.prepare(`
    INSERT INTO background_jobs (
      guild_id,
      channel_id,
      user_id,
      title,
      description
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  private findByIdStatement = db.prepare(`
    SELECT *
    FROM background_jobs
    WHERE id = ?
  `);

  private findByUserIdStatement = db.prepare(`
    SELECT *
    FROM background_jobs
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `);

  private updateStatusStatement = db.prepare(`
    UPDATE background_jobs
    SET status = ?,
        steps_total = COALESCE(?, steps_total),
        started_at = COALESCE(?, started_at),
        completed_at = ?
    WHERE id = ?
  `);

  private updateProgressStatement = db.prepare(`
    UPDATE background_jobs
    SET steps_done = ?,
        progress = ?,
        progress_message = ?
    WHERE id = ?
      AND status = 'running'
  `);

  private setResultStatement = db.prepare(`
    UPDATE background_jobs
    SET result = ?,
        progress = 100,
        steps_done = steps_total,
        progress_message = ?,
        completed_at = ?
    WHERE id = ?
  `);

  private setErrorStatement = db.prepare(`
    UPDATE background_jobs
    SET error_message = ?,
        completed_at = ?
    WHERE id = ?
  `);

  private cancelStatement = db.prepare(`
    UPDATE background_jobs
    SET status = 'cancelled',
        progress_message = 'Cancelled by user',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND user_id = ?
      AND status = 'queued'
  `);

  create(input: CreateBackgroundJobInput): BackgroundJob {
    const result = this.insertStatement.run(
      input.guildId,
      input.channelId,
      input.userId,
      input.title,
      input.description
    );

    const created = this.findById(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error('ジョブの保存に失敗しました。');
    }

    return created;
  }

  findById(id: number): BackgroundJob | null {
    return mapBackgroundJob(this.findByIdStatement.get(id) as BackgroundJobRow | undefined);
  }

  findByUserId(userId: string, limit = 10): BackgroundJob[] {
    const rows = this.findByUserIdStatement.all(userId, limit) as BackgroundJobRow[];
    return rows
      .map((row) => mapBackgroundJob(row))
      .filter((row): row is BackgroundJob => row !== null);
  }

  updateStatus(
    id: number,
    status: BackgroundJobStatus,
    options?: { stepsTotal?: number; startedAt?: string | null; completedAt?: string | null }
  ): boolean {
    const result = this.updateStatusStatement.run(
      status,
      options?.stepsTotal ?? null,
      options?.startedAt ?? null,
      options?.completedAt ?? null,
      id
    );
    return (result.changes ?? 0) > 0;
  }

  updateProgress(id: number, stepsDone: number, progressMessage: string): boolean {
    const job = this.findById(id);
    if (!job) {
      return false;
    }

    const normalizedStepsDone = Math.max(0, Math.min(stepsDone, job.stepsTotal));
    const progress =
      job.stepsTotal <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((normalizedStepsDone / job.stepsTotal) * 100)));

    const result = this.updateProgressStatement.run(
      normalizedStepsDone,
      progress,
      progressMessage,
      id
    );
    return (result.changes ?? 0) > 0;
  }

  setResult(id: number, resultText: string): boolean {
    const result = this.setResultStatement.run(
      resultText,
      'Completed',
      new Date().toISOString(),
      id
    );
    return (result.changes ?? 0) > 0;
  }

  setError(id: number, errorMessage: string): boolean {
    const result = this.setErrorStatement.run(errorMessage, new Date().toISOString(), id);
    return (result.changes ?? 0) > 0;
  }

  cancel(id: number, userId: string): boolean {
    const result = this.cancelStatement.run(id, userId);
    return (result.changes ?? 0) > 0;
  }
}

export default new JobRepository();
