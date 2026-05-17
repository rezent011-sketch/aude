import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Message,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import {
  APPROVAL_TIMEOUT_MS,
  buildApprovalButtons,
  buildCompletedApprovalEmbed,
  buildFailedApprovalEmbed,
  buildPendingApprovalEmbed,
  buildRejectedApprovalEmbed,
  buildRunningApprovalEmbed,
  buildTimedOutApprovalEmbed,
  parseApprovalCustomId,
} from '../components/approval';
import ApprovalRepository, { ApprovalRecord } from '../db/approvalRepository';
import { ModelChoice, routeToLLM } from '../llm/router';
import SubscriptionRepository from '../db/subscriptionRepository';
import { formatElapsed, splitMessage, truncate } from '../utils/discord';

interface CreateApprovalRequestInput {
  description: string;
  model: ModelChoice;
}

function requireGuildContext(
  interaction: ChatInputCommandInteraction
): { guildId: string; channelId: string } {
  if (!interaction.guildId || !interaction.channelId) {
    throw new Error('このコマンドはサーバーチャンネルでのみ利用できます。');
  }

  return {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  };
}

function buildTaskPrompt(description: string): string {
  return `Task: ${description}

Please complete this task thoroughly and return the results.`;
}

class ApprovalService {
  private client: Client | null = null;
  private timers = new Map<number, NodeJS.Timeout>();

  async initialize(client: Client): Promise<void> {
    this.client = client;

    const pendingApprovals = ApprovalRepository.listPending();
    for (const approval of pendingApprovals) {
      await this.restorePendingApproval(approval);
    }
  }

  async createApprovalRequest(
    interaction: ChatInputCommandInteraction,
    input: CreateApprovalRequestInput
  ): Promise<void> {
    const { guildId, channelId } = requireGuildContext(interaction);
    const subscription = SubscriptionRepository.getByDiscordId(interaction.user.id);
    const approval = ApprovalRepository.create({
      requesterDiscordId: interaction.user.id,
      requesterUsername: interaction.user.username,
      requesterPlan: subscription?.plan ?? 'free',
      guildId,
      channelId,
      taskDescription: input.description,
      model: input.model,
      expiresAt: new Date(Date.now() + APPROVAL_TIMEOUT_MS).toISOString(),
    });

    const reply = (await interaction.reply({
      embeds: [buildPendingApprovalEmbed(approval)],
      components: [buildApprovalButtons(approval.id)],
      fetchReply: true,
    })) as Message;

    const saved = ApprovalRepository.setMessageId(approval.id, reply.id) ?? approval;
    this.scheduleTimeout(saved);
  }

  async handleButtonInteraction(interaction: ButtonInteraction): Promise<boolean> {
    const parsed = parseApprovalCustomId(interaction.customId);
    if (!parsed) {
      return false;
    }

    const approval = ApprovalRepository.getById(parsed.approvalId);
    if (!approval) {
      await interaction.reply({
        content: '対象の承認タスクが見つかりません。',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (approval.status !== 'pending') {
      await interaction.reply({
        content: `このタスクはすでに ${approval.status} です。`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (!this.canDecide(interaction, approval)) {
      await interaction.reply({
        content:
          approval.requesterPlan === 'team'
            ? 'このタスクの承認にはサーバー内のメンバーである必要があります。'
            : 'このタスクを承認または拒否できるのは管理者のみです。',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (parsed.action === 'reject') {
      const rejected = ApprovalRepository.reject(
        approval.id,
        interaction.user.id,
        interaction.user.username
      );

      if (!rejected) {
        await interaction.reply({
          content:
            'このタスクは別の操作で更新されました。`/pending` で再確認してください。',
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      this.clearTimeout(rejected.id);
      await interaction.update({
        embeds: [buildRejectedApprovalEmbed(rejected)],
        components: [buildApprovalButtons(rejected.id, true)],
      });
      return true;
    }

    const running = ApprovalRepository.startExecution(
      approval.id,
      interaction.user.id,
      interaction.user.username
    );

    if (!running) {
      await interaction.reply({
        content:
          'このタスクは別の操作で更新されました。`/pending` で再確認してください。',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    this.clearTimeout(running.id);
    await interaction.update({
      embeds: [buildRunningApprovalEmbed(running)],
      components: [buildApprovalButtons(running.id, true)],
    });

    void this.executeApprovedTask(running);
    return true;
  }

  private async restorePendingApproval(approval: ApprovalRecord): Promise<void> {
    const expiresAt = new Date(approval.expiresAt).getTime();
    if (expiresAt <= Date.now()) {
      const timedOut = ApprovalRepository.timeout(approval.id);
      if (timedOut) {
        await this.updateApprovalMessage(timedOut, buildTimedOutApprovalEmbed(timedOut));
      }
      return;
    }

    this.scheduleTimeout(approval);
  }

  private scheduleTimeout(approval: ApprovalRecord): void {
    this.clearTimeout(approval.id);

    const delay = new Date(approval.expiresAt).getTime() - Date.now();
    if (delay <= 0) {
      void this.handleTimeout(approval.id);
      return;
    }

    const timer = setTimeout(() => {
      void this.handleTimeout(approval.id);
    }, delay);

    this.timers.set(approval.id, timer);
  }

  private clearTimeout(approvalId: number): void {
    const timer = this.timers.get(approvalId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.timers.delete(approvalId);
  }

  private canDecide(interaction: ButtonInteraction, approval: ApprovalRecord): boolean {
    if (!interaction.inGuild()) {
      return false;
    }

    if (approval.requesterPlan === 'team') {
      return true;
    }

    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
  }

  private async handleTimeout(approvalId: number): Promise<void> {
    this.clearTimeout(approvalId);

    const timedOut = ApprovalRepository.timeout(approvalId);
    if (!timedOut) {
      return;
    }

    await this.updateApprovalMessage(timedOut, buildTimedOutApprovalEmbed(timedOut));
  }

  private async executeApprovedTask(approval: ApprovalRecord): Promise<void> {
    const startTime = Date.now();
    let result: string;

    try {
      result = await routeToLLM(buildTaskPrompt(approval.taskDescription), approval.model);
    } catch (error) {
      console.error(`Error executing approved task #${approval.id}:`, error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      const failed = ApprovalRepository.fail(approval.id, truncate(errorMessage, 1000));
      const failedRecord = failed ?? {
        ...approval,
        status: 'failed' as const,
        errorMessage: truncate(errorMessage, 1000),
        completedAt: new Date().toISOString(),
      };

      await this.updateApprovalMessage(failedRecord, buildFailedApprovalEmbed(failedRecord));
      await this.sendFailureMessage(failedRecord);
      return;
    }

    const completed = ApprovalRepository.complete(approval.id, truncate(result, 500));
    const completedRecord = completed ?? {
      ...approval,
      status: 'completed' as const,
      resultSummary: truncate(result, 500),
      completedAt: new Date().toISOString(),
    };

    try {
      await this.updateApprovalMessage(
        completedRecord,
        buildCompletedApprovalEmbed(completedRecord)
      );
      await this.sendTaskResult(completedRecord, result, formatElapsed(startTime));
    } catch (error) {
      console.error(`Error sending completion updates for task #${approval.id}:`, error);
    }
  }

  private async updateApprovalMessage(
    approval: ApprovalRecord,
    embed: EmbedBuilder
  ): Promise<void> {
    const message = await this.fetchApprovalMessage(approval);
    if (!message) {
      return;
    }

    await message.edit({
      embeds: [embed],
      components: [buildApprovalButtons(approval.id, true)],
    });
  }

  private async sendTaskResult(
    approval: ApprovalRecord,
    result: string,
    elapsed: string
  ): Promise<void> {
    const channel = await this.fetchTextChannel(approval.channelId);
    if (!channel) {
      return;
    }

    const parts = splitMessage(result);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Task Complete #${approval.id}`)
      .setDescription(parts[0])
      .addFields(
        { name: '依頼者', value: `<@${approval.requesterDiscordId}>`, inline: true },
        {
          name: '承認者',
          value: approval.approverDiscordId ? `<@${approval.approverDiscordId}>` : '不明',
          inline: true,
        },
        { name: 'モデル', value: approval.model, inline: true }
      )
      .setFooter({ text: `Completed in ${elapsed}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    for (let index = 1; index < parts.length; index += 1) {
      await channel.send({ content: parts[index] });
    }
  }

  private async sendFailureMessage(approval: ApprovalRecord): Promise<void> {
    const channel = await this.fetchTextChannel(approval.channelId);
    if (!channel) {
      return;
    }

    await channel.send({
      content: [
        `⚠️ 承認済みタスク #${approval.id} の実行に失敗しました。`,
        `依頼者: <@${approval.requesterDiscordId}>`,
        `エラー: ${approval.errorMessage ?? '不明なエラー'}`,
      ].join('\n'),
    });
  }

  private async fetchApprovalMessage(approval: ApprovalRecord): Promise<Message | null> {
    if (!approval.messageId) {
      return null;
    }

    const channel = await this.fetchTextChannel(approval.channelId);
    if (!channel) {
      return null;
    }

    try {
      return await channel.messages.fetch(approval.messageId);
    } catch (error) {
      console.warn(`Failed to fetch approval message ${approval.messageId}:`, error);
      return null;
    }
  }

  private async fetchTextChannel(channelId: string) {
    if (!this.client) {
      throw new Error('approvalService is not initialized');
    }

    const channel = await this.client.channels.fetch(channelId);
    if (
      !channel ||
      !channel.isTextBased() ||
      !channel.isSendable() ||
      !('messages' in channel)
    ) {
      return null;
    }

    return channel;
  }
}

export default new ApprovalService();
