import db from './index';
import UserRepository from './userRepository';
import { ModelChoice } from '../llm/router';
import { SubscriptionPlan } from '../stripe/plans';

export type ApprovalStatus =
  | 'pending'
  | 'running'
  | 'rejected'
  | 'timed_out'
  | 'completed'
  | 'failed';

export interface ApprovalRecord {
  id: number;
  userId: number;
  requesterDiscordId: string;
  requesterUsername: string;
  requesterPlan: SubscriptionPlan;
  guildId: string;
  channelId: string;
  messageId: string | null;
  taskDescription: string;
  model: ModelChoice;
  status: ApprovalStatus;
  approverDiscordId: string | null;
  approverUsername: string | null;
  decidedAt: string | null;
  expiresAt: string;
  startedAt: string | null;
  completedAt: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ApprovalRow {
  id: number;
  user_id: number;
  requester_discord_id: string;
  requester_username: string;
  requester_plan: SubscriptionPlan;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  task_description: string;
  model: ModelChoice;
  status: ApprovalStatus;
  approver_discord_id: string | null;
  approver_username: string | null;
  decided_at: string | null;
  expires_at: string;
  started_at: string | null;
  completed_at: string | null;
  result_summary: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CreateApprovalInput {
  requesterDiscordId: string;
  requesterUsername: string;
  requesterPlan: SubscriptionPlan;
  guildId: string;
  channelId: string;
  taskDescription: string;
  model: ModelChoice;
  expiresAt: string;
}

function mapApproval(row: ApprovalRow | undefined): ApprovalRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    requesterDiscordId: row.requester_discord_id,
    requesterUsername: row.requester_username,
    requesterPlan: row.requester_plan,
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    taskDescription: row.task_description,
    model: row.model,
    status: row.status,
    approverDiscordId: row.approver_discord_id,
    approverUsername: row.approver_username,
    decidedAt: row.decided_at,
    expiresAt: row.expires_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    resultSummary: row.result_summary,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

class ApprovalRepository {
  private insertStatement = db.prepare(`
    INSERT INTO approvals (
      user_id,
      requester_discord_id,
      requester_username,
      requester_plan,
      guild_id,
      channel_id,
      task_description,
      model,
      status,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `);
  private getByIdStatement = db.prepare(`
    SELECT *
    FROM approvals
    WHERE id = ?
  `);
  private setMessageIdStatement = db.prepare(`
    UPDATE approvals
    SET message_id = ?
    WHERE id = ?
  `);
  private listPendingByGuildStatement = db.prepare(`
    SELECT *
    FROM approvals
    WHERE guild_id = ?
      AND status = 'pending'
    ORDER BY id ASC
  `);
  private listPendingStatement = db.prepare(`
    SELECT *
    FROM approvals
    WHERE status = 'pending'
    ORDER BY id ASC
  `);
  private startExecutionStatement = db.prepare(`
    UPDATE approvals
    SET status = 'running',
        approver_discord_id = ?,
        approver_username = ?,
        decided_at = CURRENT_TIMESTAMP,
        started_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND status = 'pending'
  `);
  private rejectStatement = db.prepare(`
    UPDATE approvals
    SET status = 'rejected',
        approver_discord_id = ?,
        approver_username = ?,
        decided_at = CURRENT_TIMESTAMP,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND status = 'pending'
  `);
  private timeoutStatement = db.prepare(`
    UPDATE approvals
    SET status = 'timed_out',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND status = 'pending'
  `);
  private completeStatement = db.prepare(`
    UPDATE approvals
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        result_summary = ?,
        error_message = NULL
    WHERE id = ?
      AND status = 'running'
  `);
  private failStatement = db.prepare(`
    UPDATE approvals
    SET status = 'failed',
        completed_at = CURRENT_TIMESTAMP,
        error_message = ?
    WHERE id = ?
      AND status = 'running'
  `);

  create(input: CreateApprovalInput): ApprovalRecord {
    const user = UserRepository.getOrCreateUser(
      input.requesterDiscordId,
      input.requesterUsername
    );
    const info = this.insertStatement.run(
      user.id,
      input.requesterDiscordId,
      input.requesterUsername,
      input.requesterPlan,
      input.guildId,
      input.channelId,
      input.taskDescription,
      input.model,
      input.expiresAt
    );

    const created = this.getById(Number(info.lastInsertRowid));
    if (!created) {
      throw new Error('承認タスクの保存に失敗しました。');
    }

    return created;
  }

  getById(id: number): ApprovalRecord | null {
    return mapApproval(this.getByIdStatement.get(id) as ApprovalRow | undefined);
  }

  setMessageId(id: number, messageId: string): ApprovalRecord | null {
    this.setMessageIdStatement.run(messageId, id);
    return this.getById(id);
  }

  listPendingByGuild(guildId: string): ApprovalRecord[] {
    const rows = this.listPendingByGuildStatement.all(guildId) as ApprovalRow[];
    return rows
      .map((row) => mapApproval(row))
      .filter((row): row is ApprovalRecord => row !== null);
  }

  listPending(): ApprovalRecord[] {
    const rows = this.listPendingStatement.all() as ApprovalRow[];
    return rows
      .map((row) => mapApproval(row))
      .filter((row): row is ApprovalRecord => row !== null);
  }

  startExecution(
    id: number,
    approverDiscordId: string,
    approverUsername: string
  ): ApprovalRecord | null {
    const info = this.startExecutionStatement.run(approverDiscordId, approverUsername, id);
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  reject(id: number, approverDiscordId: string, approverUsername: string): ApprovalRecord | null {
    const info = this.rejectStatement.run(approverDiscordId, approverUsername, id);
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  timeout(id: number): ApprovalRecord | null {
    const info = this.timeoutStatement.run(id);
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  complete(id: number, resultSummary: string): ApprovalRecord | null {
    const info = this.completeStatement.run(resultSummary, id);
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  fail(id: number, errorMessage: string): ApprovalRecord | null {
    const info = this.failStatement.run(errorMessage, id);
    if (info.changes === 0) {
      return null;
    }
    return this.getById(id);
  }
}

export default new ApprovalRepository();
