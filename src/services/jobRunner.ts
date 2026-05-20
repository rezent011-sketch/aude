import { Client } from 'discord.js';
import JobRepository, { BackgroundJob } from '../db/jobRepository';
import { routeToLLM } from '../llm/router';
import { splitMessage, truncate } from '../utils/discord';

const STEP_DELAY_MS = 500;
const MAX_STEPS = 5;

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseSteps(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_STEPS);
  } catch {
    return [];
  }
}

function buildExecutionPrompt(job: BackgroundJob, step: string, stepIndex: number, totalSteps: number): string {
  return `You are executing one step of a longer background task for Discord.

Overall task:
${job.description}

Current step (${stepIndex}/${totalSteps}):
${step}

Instructions:
- Complete only this step.
- Return the concrete result for this step.
- Be concise but useful.
- Do not mention that this is a background task unless relevant.`;
}

class JobRunner {
  async runJob(job: BackgroundJob, client: Client): Promise<void> {
    try {
      const startedAt = new Date().toISOString();
      JobRepository.updateStatus(job.id, 'running', {
        stepsTotal: 1,
        startedAt,
      });
      JobRepository.updateProgress(job.id, 0, 'Planning steps');

      const stepPlanRaw = await routeToLLM(
        'Break this task into 3-5 concrete steps. Return ONLY a JSON array of step descriptions: ["step1", "step2", ...]  Task: ' +
          job.description,
        'auto',
        undefined,
        job.channelId,
        undefined,
        job.guildId ?? undefined
      );
      const parsedSteps = parseSteps(stepPlanRaw);
      const steps = parsedSteps.length > 0 ? parsedSteps : [job.description];

      JobRepository.updateStatus(job.id, 'running', {
        stepsTotal: steps.length,
      });
      JobRepository.updateProgress(job.id, 0, 'Starting job');

      const stepResults: string[] = [];

      for (let index = 0; index < steps.length; index += 1) {
        const current = JobRepository.findById(job.id);
        if (!current) {
          throw new Error(`Job #${job.id} not found`);
        }

        if (current.status === 'cancelled') {
          return;
        }

        const step = steps[index];
        JobRepository.updateProgress(job.id, index, `Step ${index + 1}/${steps.length}: ${step}`);

        const result = await routeToLLM(
          buildExecutionPrompt(job, step, index + 1, steps.length),
          'auto',
          undefined,
          job.channelId,
          undefined,
          job.guildId ?? undefined
        );

        stepResults.push(`Step ${index + 1}: ${step}\n${result}`);
        JobRepository.updateProgress(job.id, index + 1, `Completed step ${index + 1}/${steps.length}: ${step}`);

        if (index < steps.length - 1) {
          await delay(STEP_DELAY_MS);
        }
      }

      const finalResult = stepResults.join('\n\n');

      JobRepository.setResult(job.id, finalResult);
      JobRepository.updateStatus(job.id, 'completed', {
        stepsTotal: steps.length,
        completedAt: new Date().toISOString(),
      });

      const completed = JobRepository.findById(job.id) ?? job;
      await this.notify(
        completed,
        client,
        [
          `✅ ジョブ #${job.id} が完了しました`,
          `タイトル: ${truncate(job.title, 120)}`,
          `概要: ${truncate(finalResult, 1200)}`,
        ].join('\n')
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      JobRepository.setError(job.id, errorMessage);
      const current = JobRepository.findById(job.id);

      if (current?.status !== 'cancelled') {
        JobRepository.updateStatus(job.id, 'failed', {
          stepsTotal: current?.stepsTotal ?? 1,
          completedAt: new Date().toISOString(),
        });
      }

      await this.notify(
        current ?? job,
        client,
        [
          `❌ ジョブ #${job.id} の実行に失敗しました`,
          `タイトル: ${truncate(job.title, 120)}`,
          `理由: ${truncate(errorMessage, 500)}`,
        ].join('\n')
      );
    }
  }

  async notify(job: BackgroundJob, client: Client, message: string): Promise<void> {
    try {
      const channel = await client.channels.fetch(job.channelId);
      if (!isTextChannel(channel)) {
        console.error(`[JobRunner] Channel ${job.channelId} is not a text channel`);
        return;
      }

      const parts = splitMessage(`<@${job.userId}> ${message}`, 1900);
      for (const part of parts) {
        await channel.send(part);
      }
    } catch (error) {
      console.error(`[JobRunner] Failed to notify job #${job.id} in channel ${job.channelId}:`, error);
    }
  }
}

export default new JobRunner();
