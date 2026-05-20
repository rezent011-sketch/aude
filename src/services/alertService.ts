import { Client } from 'discord.js';
import cron, { ScheduledTask } from 'node-cron';
import AlertRepository, { Alert, AlertType } from '../db/alertRepository';

const DEFAULT_TIMEZONE = process.env.SCHEDULE_TIMEZONE ?? 'Asia/Tokyo';
const DEFAULT_CRON = '0 9 * * *';

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

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

class AlertService {
  private client: Client | null = null;
  private initialized = false;
  private tasks = new Map<number, ScheduledTask>();

  initialize(client: Client): void {
    if (this.initialized) {
      this.client = client;
      return;
    }

    this.client = client;
    this.initialized = true;

    const alerts = AlertRepository.findActiveAlerts();
    let loadedCount = 0;

    for (const alert of alerts) {
      try {
        this.scheduleAlert(alert);
        loadedCount += 1;
      } catch (error) {
        console.error(`[Alert] Failed to load alert #${alert.id}:`, error);
        AlertRepository.setActive(alert.id, alert.guildId, false);
      }
    }

    console.log(`[Alert] Loaded ${loadedCount} active alerts`);
  }

  scheduleAlert(alert: Alert): void {
    this.detachTask(alert.id);

    if (!alert.isActive) {
      return;
    }

    const cronExpr = alert.cronExpr ?? this.conditionToCron(alert.condition);
    if (!cron.validate(cronExpr)) {
      throw new Error(`Invalid cron expression for alert #${alert.id}: ${cronExpr}`);
    }

    const task = cron.schedule(
      cronExpr,
      async () => {
        await this.triggerAlert(alert.id);
      },
      {
        timezone: DEFAULT_TIMEZONE,
        name: `alert-${alert.id}`,
        noOverlap: true,
      }
    );

    this.tasks.set(alert.id, task);
  }

  async addAlert(params: {
    guildId: string;
    channelId: string;
    createdBy: string;
    type?: AlertType;
    name: string;
    condition: string;
    message: string;
  }): Promise<Alert> {
    const alert = AlertRepository.create({
      guildId: params.guildId,
      channelId: params.channelId,
      createdBy: params.createdBy,
      alertType: params.type ?? 'schedule',
      name: params.name.trim(),
      condition: params.condition.trim(),
      cronExpr: this.conditionToCron(params.condition),
      message: params.message.trim(),
      isActive: true,
    });

    try {
      this.scheduleAlert(alert);
      return alert;
    } catch (error) {
      AlertRepository.delete(alert.id, alert.guildId);
      throw error;
    }
  }

  async removeAlert(id: number, guildId: string): Promise<boolean> {
    const alert = AlertRepository.getByIdForGuild(id, guildId);
    if (!alert) {
      return false;
    }

    this.detachTask(id);
    return AlertRepository.setActive(id, guildId, false);
  }

  async toggleAlert(id: number, guildId: string): Promise<Alert | null> {
    const alert = AlertRepository.getByIdForGuild(id, guildId);
    if (!alert) {
      return null;
    }

    const nextState = !alert.isActive;
    const updated = AlertRepository.setActive(id, guildId, nextState);
    if (!updated) {
      return null;
    }

    const refreshed = AlertRepository.getByIdForGuild(id, guildId);
    if (!refreshed) {
      return null;
    }

    if (refreshed.isActive) {
      this.scheduleAlert(refreshed);
    } else {
      this.detachTask(refreshed.id);
    }

    return refreshed;
  }

  listAlerts(guildId: string): Alert[] {
    return AlertRepository.findByGuildId(guildId);
  }

  conditionToCron(condition: string): string {
    const normalized = condition.trim().toLowerCase();
    const compact = condition.replace(/\s+/g, '');

    if (normalized === 'every hour' || compact === '1時間ごと') {
      return '0 * * * *';
    }

    const everyMinutes = normalized.match(/^every (\d+) minutes?$/);
    if (everyMinutes) {
      return `*/${everyMinutes[1]} * * * *`;
    }

    const jpMinutes = compact.match(/^(\d+)分ごと$/);
    if (jpMinutes) {
      return `*/${jpMinutes[1]} * * * *`;
    }

    const dailyEnglish = normalized.match(/^every day at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (dailyEnglish) {
      const { hour, minute } = this.parseHourMinute(dailyEnglish[1], dailyEnglish[2], dailyEnglish[3]);
      return `${minute} ${hour} * * *`;
    }

    const dailyJapanese = compact.match(/^毎日(\d{1,2})時(?:(\d{1,2})分)?$/);
    if (dailyJapanese) {
      return `${dailyJapanese[2] ?? '0'} ${dailyJapanese[1]} * * *`;
    }

    const weeklyEnglish = normalized.match(
      /^every (sunday|monday|tuesday|wednesday|thursday|friday|saturday) at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/
    );
    if (weeklyEnglish) {
      const day = WEEKDAY_MAP[weeklyEnglish[1]];
      const { hour, minute } = this.parseHourMinute(
        weeklyEnglish[2],
        weeklyEnglish[3],
        weeklyEnglish[4]
      );
      return `${minute} ${hour} * * ${day}`;
    }

    const weeklyJapanese = compact.match(/^毎週(月|火|水|木|金|土|日)曜?(\d{1,2})時(?:(\d{1,2})分)?$/);
    if (weeklyJapanese) {
      const dayMap: Record<string, number> = {
        日: 0,
        月: 1,
        火: 2,
        水: 3,
        木: 4,
        金: 5,
        土: 6,
      };
      return `${weeklyJapanese[3] ?? '0'} ${weeklyJapanese[2]} * * ${dayMap[weeklyJapanese[1]]}`;
    }

    return DEFAULT_CRON;
  }

  private parseHourMinute(hourText: string, minuteText?: string, meridiem?: string): {
    hour: number;
    minute: number;
  } {
    let hour = Number(hourText);
    const minute = Number(minuteText ?? '0');

    if (meridiem === 'pm' && hour < 12) {
      hour += 12;
    } else if (meridiem === 'am' && hour === 12) {
      hour = 0;
    }

    return { hour, minute };
  }

  private detachTask(alertId: number): void {
    const existing = this.tasks.get(alertId);
    if (!existing) {
      return;
    }

    existing.stop();
    existing.destroy();
    this.tasks.delete(alertId);
  }

  private async triggerAlert(alertId: number): Promise<void> {
    const alert = AlertRepository.getById(alertId);
    if (!alert || !alert.isActive) {
      return;
    }

    const channel = await this.resolveChannel(alert.channelId);
    if (!channel) {
      console.warn(`[Alert] Channel not found for alert #${alert.id}`);
      return;
    }

    try {
      await channel.send(alert.message);
      AlertRepository.recordTrigger(alert.id, new Date().toISOString());
    } catch (error) {
      console.error(`[Alert] Failed to trigger alert #${alert.id}:`, error);
    }
  }

  private async resolveChannel(channelId: string): Promise<SendableChannel | null> {
    if (!this.client) {
      return null;
    }

    const cached = this.client.channels.cache.get(channelId);
    if (isTextChannel(cached)) {
      return cached;
    }

    try {
      const fetched = await this.client.channels.fetch(channelId);
      if (isTextChannel(fetched)) {
        return fetched;
      }
    } catch (error) {
      console.error(`[Alert] Failed to fetch channel ${channelId}:`, error);
    }

    return null;
  }
}

export default new AlertService();
