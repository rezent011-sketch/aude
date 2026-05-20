import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import JobRepository, { BackgroundJob, BackgroundJobStatus } from '../db/jobRepository';
import jobRunner from '../services/jobRunner';
import { truncate } from '../utils/discord';

const MAX_TASK_LENGTH = 800;

function buildProgressBar(stepsDone: number, stepsTotal: number): string {
  const total = Math.max(1, stepsTotal);
  const completed = Math.max(0, Math.min(stepsDone, total));
  const filled = Math.round((completed / total) * 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${completed}/${total}`;
}

function getStatusEmoji(status: BackgroundJobStatus): string {
  switch (status) {
    case 'queued':
      return '⏳';
    case 'running':
      return '🔄';
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    case 'cancelled':
      return '🚫';
    default:
      return '❔';
  }
}

function getStatusLabel(status: BackgroundJobStatus): string {
  switch (status) {
    case 'queued':
      return '待機中';
    case 'running':
      return '実行中';
    case 'completed':
      return '完了';
    case 'failed':
      return '失敗';
    case 'cancelled':
      return 'キャンセル済み';
    default:
      return status;
  }
}

function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleString('ja-JP', {
    hour12: false,
    timeZone: 'Asia/Tokyo',
  });
}

function buildListEmbed(jobs: BackgroundJob[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('最近のバックグラウンドジョブ')
    .setTimestamp();

  if (jobs.length === 0) {
    embed.setDescription('まだジョブはありません。');
    return embed;
  }

  embed.addFields(
    jobs.map((job) => ({
      name: `#${job.id} ${job.title}`,
      value: [
        `${getStatusEmoji(job.status)} ${getStatusLabel(job.status)}`,
        `作成: ${formatCreatedAt(job.createdAt)}`,
      ].join('\n'),
      inline: false,
    }))
  );

  return embed;
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'ジョブ処理中にエラーが発生しました。しばらくしてから再度お試しください。';
}

export const jobCommand = {
  data: new SlashCommandBuilder()
    .setName('job')
    .setDescription('長時間タスクをバックグラウンドで実行します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('バックグラウンドジョブを開始します')
        .addStringOption((option) =>
          option
            .setName('task')
            .setDescription('実行したいタスク')
            .setRequired(true)
            .setMaxLength(MAX_TASK_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('ジョブの状態を確認します')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('確認するジョブID')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('最近のジョブを一覧表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('cancel')
        .setDescription('待機中のジョブをキャンセルします')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('キャンセルするジョブID')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'start') {
        const task = interaction.options.getString('task', true).trim();
        const job = JobRepository.create({
          guildId: interaction.guildId ?? null,
          channelId: interaction.channelId,
          userId: interaction.user.id,
          title: truncate(task, 80),
          description: task,
        });

        await interaction.reply({
          content: `ジョブ開始！完了したら通知します 🚀 (ID: ${job.id})`,
          flags: MessageFlags.Ephemeral,
        });

        void jobRunner.runJob(job, interaction.client).catch((error) => {
          console.error(`[JobCommand] Background execution failed for job #${job.id}:`, error);
        });
        return;
      }

      if (subcommand === 'list') {
        const jobs = JobRepository.findByUserId(interaction.user.id, 10);
        await interaction.reply({
          embeds: [buildListEmbed(jobs)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const id = interaction.options.getInteger('id', true);
      const job = JobRepository.findById(id);

      if (!job || job.userId !== interaction.user.id) {
        await interaction.reply({
          content: `❌ ジョブ #${id} が見つかりません。`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === 'status') {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`ジョブ #${job.id}`)
          .addFields(
            { name: '状態', value: `${getStatusEmoji(job.status)} ${getStatusLabel(job.status)}`, inline: true },
            { name: '進捗', value: buildProgressBar(job.stepsDone, job.stepsTotal), inline: true },
            { name: 'タイトル', value: truncate(job.title, 200), inline: false },
            { name: '現在のステップ', value: job.progressMessage ?? '未開始', inline: false }
          )
          .setTimestamp();

        if (job.status === 'completed' && job.result) {
          embed.addFields({ name: '結果', value: truncate(job.result, 1000), inline: false });
        }

        if (job.status === 'failed' && job.errorMessage) {
          embed.addFields({ name: 'エラー', value: truncate(job.errorMessage, 1000), inline: false });
        }

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === 'cancel') {
        const cancelled = JobRepository.cancel(id, interaction.user.id);
        await interaction.reply({
          content: cancelled
            ? `🚫 ジョブ #${id} をキャンセルしました。`
            : `❌ ジョブ #${id} はキャンセルできません。待機中のジョブのみ対象です。`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      const message = toUserErrorMessage(error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
