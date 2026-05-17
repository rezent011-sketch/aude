import { Client } from 'discord.js';
import cron, { ScheduledTask } from 'node-cron';
import ScheduleRepository, { ScheduleRecord } from '../db/scheduleRepository';
import UserRepository from '../db/userRepository';
import { routeToLLM } from '../llm/router';
import { splitMessage, truncate } from '../utils/discord';

const DEFAULT_TIMEZONE = process.env.SCHEDULE_TIMEZONE ?? 'Asia/Tokyo';
const RESULT_CHUNK_SIZE = 1800;

function toIsoString(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '未設定';
  }

  return new Date(value).toLocaleString('ja-JP', {
    hour12: false,
    timeZone: DEFAULT_TIMEZONE,
  });
}

type SendableChannel = {
  send(content: string): Promise<unknown>;
};

function isTextChannel(channel: unknown): channel is SendableChannel {
  return Boolean(
    channel &&
      typeof channel === 'object' &&
      'isTextBased' in channel &&
      typeof channel.isTextBased === 'function' &&
      channel.isTextBased() &&
      'send' in channel &&
      typeof channel.send === 'function'
  );
}

class ScheduleService {
  private client: Client | null = null;
  private initialized = false;
  private tasks = new Map<number, ScheduledTask>();

  async initialize(client: Client): Promise<void> {
    if (this.initialized) {
      this.client = client;
      return;
    }

    this.client = client;
    this.initialized = true;

    const schedules = ScheduleRepository.listActive();
    let loadedCount = 0;
    for (const schedule of schedules) {
      try {
        this.attachCronTask(schedule);
        loadedCount += 1;
      } catch (error) {
        console.error(`[Schedule] Failed to load schedule #${schedule.id}:`, error);
        ScheduleRepository.updateStatus(schedule.id, false, null);
      }
    }

    console.log(`[Schedule] Loaded ${loadedCount} active schedules`);
  }

  listSchedules(discordUserId: string, username: string, guildId: string): ScheduleRecord[] {
    const user = UserRepository.getOrCreateUser(discordUserId, username);
    return ScheduleRepository.listByUser(user.id, guildId);
  }

  createSchedule(input: {
    discordUserId: string;
    username: string;
    guildId: string;
    channelId: string;
    cronExpr: string;
    task: string;
  }): ScheduleRecord {
    if (!cron.validate(input.cronExpr)) {
      throw new Error(
        'cron式の形式が正しくありません。5フィールドまたは6フィールドのcron式を指定してください。'
      );
    }

    const user = UserRepository.getOrCreateUser(input.discordUserId, input.username);
    const schedule = ScheduleRepository.create({
      userId: user.id,
      guildId: input.guildId,
      channelId: input.channelId,
      cronExpr: input.cronExpr,
      task: input.task.trim(),
      isActive: true,
    });

    try {
      return this.attachCronTask(schedule);
    } catch (error) {
      ScheduleRepository.delete(schedule.id);
      throw error;
    }
  }

  pauseSchedule(scheduleId: number, discordUserId: string, username: string, guildId: string): ScheduleRecord {
    const schedule = this.getOwnedSchedule(scheduleId, discordUserId, username, guildId);
    this.detachCronTask(schedule.id);
    ScheduleRepository.updateStatus(schedule.id, false, null);

    return this.requireSchedule(schedule.id);
  }

  resumeSchedule(scheduleId: number, discordUserId: string, username: string, guildId: string): ScheduleRecord {
    const schedule = this.getOwnedSchedule(scheduleId, discordUserId, username, guildId);
    if (schedule.isActive) {
      return schedule;
    }

    ScheduleRepository.updateStatus(schedule.id, true, null);
    try {
      return this.attachCronTask(this.requireSchedule(schedule.id));
    } catch (error) {
      ScheduleRepository.updateStatus(schedule.id, false, null);
      throw error;
    }
  }

  deleteSchedule(scheduleId: number, discordUserId: string, username: string, guildId: string): ScheduleRecord {
    const schedule = this.getOwnedSchedule(scheduleId, discordUserId, username, guildId);
    this.detachCronTask(schedule.id);
    ScheduleRepository.delete(schedule.id);
    return schedule;
  }

  private getOwnedSchedule(
    scheduleId: number,
    discordUserId: string,
    username: string,
    guildId: string
  ): ScheduleRecord {
    const user = UserRepository.getOrCreateUser(discordUserId, username);
    const schedule = ScheduleRepository.getByIdForUser(scheduleId, user.id, guildId);

    if (!schedule) {
      throw new Error(`ID ${scheduleId} のスケジュールが見つかりません。`);
    }

    return schedule;
  }

  private requireSchedule(scheduleId: number): ScheduleRecord {
    const schedule = ScheduleRepository.getById(scheduleId);
    if (!schedule) {
      throw new Error(`ID ${scheduleId} のスケジュールが見つかりません。`);
    }
    return schedule;
  }

  private attachCronTask(schedule: ScheduleRecord): ScheduleRecord {
    this.detachCronTask(schedule.id);

    if (!schedule.isActive) {
      return schedule;
    }

    const task = cron.schedule(
      schedule.cronExpr,
      async () => {
        await this.executeSchedule(schedule.id);
      },
      {
        timezone: DEFAULT_TIMEZONE,
        name: `schedule-${schedule.id}`,
        noOverlap: true,
      }
    );

    this.tasks.set(schedule.id, task);

    ScheduleRepository.updateStatus(schedule.id, true, toIsoString(task.getNextRun()));
    return this.requireSchedule(schedule.id);
  }

  private detachCronTask(scheduleId: number): void {
    const existing = this.tasks.get(scheduleId);
    if (!existing) {
      return;
    }

    existing.stop();
    existing.destroy();
    this.tasks.delete(scheduleId);
  }

  private async executeSchedule(scheduleId: number): Promise<void> {
    const schedule = ScheduleRepository.getById(scheduleId);
    if (!schedule || !schedule.isActive) {
      return;
    }

    const startedAt = new Date();
    const currentTask = this.tasks.get(scheduleId) ?? null;

    try {
      const result = await routeToLLM(
        `以下はDiscord上で定期実行されるタスクです。

タスク内容:
${schedule.task}

実行ルール:
- 依頼をそのまま実行してください
- 回答はそのままDiscordに投稿されます
- 余計な前置きは避けて、読みやすく整理してください`,
        'auto',
        undefined,
        schedule.channelId
      );

      ScheduleRepository.updateExecutionState(
        schedule.id,
        startedAt.toISOString(),
        toIsoString(currentTask?.getNextRun() ?? null)
      );

      await this.postScheduleResult(schedule, result);
    } catch (error) {
      ScheduleRepository.updateExecutionState(
        schedule.id,
        startedAt.toISOString(),
        toIsoString(currentTask?.getNextRun() ?? null)
      );

      console.error(`[Schedule] Execution failed for #${schedule.id}:`, error);
      await this.postScheduleFailure(schedule, error);
    }
  }

  private async postScheduleResult(schedule: ScheduleRecord, result: string): Promise<void> {
    const channel = await this.resolveChannel(schedule.channelId);
    if (!channel) {
      return;
    }

    const parts = splitMessage(result, RESULT_CHUNK_SIZE);
    const header = [
      `⏰ 定期タスク #${schedule.id} を実行しました`,
      `内容: ${truncate(schedule.task, 120)}`,
      `次回予定: ${formatDateTime(this.requireSchedule(schedule.id).nextRun)}`,
      '',
    ].join('\n');

    await channel.send(`${header}\n${parts[0]}`);

    for (let i = 1; i < parts.length; i += 1) {
      await channel.send(parts[i]);
    }
  }

  private async postScheduleFailure(schedule: ScheduleRecord, error: unknown): Promise<void> {
    const channel = await this.resolveChannel(schedule.channelId);
    if (!channel) {
      return;
    }

    const message = error instanceof Error ? error.message : '不明なエラー';
    await channel.send(
      [
        `⚠️ 定期タスク #${schedule.id} の実行に失敗しました。`,
        `内容: ${truncate(schedule.task, 120)}`,
        `理由: ${truncate(message, 300)}`,
      ].join('\n')
    );
  }

  private async resolveChannel(channelId: string): Promise<SendableChannel | null> {
    if (!this.client) {
      console.error('[Schedule] Discord client is not initialized');
      return null;
    }

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!isTextChannel(channel)) {
        console.error(`[Schedule] Channel ${channelId} is not a text channel`);
        return null;
      }

      return channel;
    } catch (error) {
      console.error(`[Schedule] Failed to fetch channel ${channelId}:`, error);
      return null;
    }
  }
}

export default new ScheduleService();
