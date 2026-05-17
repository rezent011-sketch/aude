import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import ApprovalRepository from '../db/approvalRepository';
import { splitMessage, truncate } from '../utils/discord';

const DISPLAY_TIME_ZONE = process.env.SCHEDULE_TIMEZONE ?? 'Asia/Tokyo';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ja-JP', {
    hour12: false,
    timeZone: DISPLAY_TIME_ZONE,
  });
}

export const pendingCommand = {
  data: new SlashCommandBuilder()
    .setName('pending')
    .setDescription('このサーバーの承認待ちタスクを一覧表示します'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: 'このコマンドはサーバーチャンネルでのみ利用できます。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const approvals = ApprovalRepository.listPendingByGuild(interaction.guildId);
    if (approvals.length === 0) {
      await interaction.reply({
        content: '承認待ちタスクはありません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const content = [
      `承認待ちタスク一覧（${approvals.length}件）`,
      ...approvals.map((approval) =>
        [
          `#${approval.id} ${truncate(approval.taskDescription, 120)}`,
          `依頼者: <@${approval.requesterDiscordId}>`,
          `モデル: ${approval.model}`,
          `期限: ${formatDateTime(approval.expiresAt)}`,
        ].join('\n')
      ),
    ].join('\n\n');

    const parts = splitMessage(content, 1900);

    await interaction.reply({
      content: parts[0],
      flags: MessageFlags.Ephemeral,
    });

    for (let index = 1; index < parts.length; index += 1) {
      await interaction.followUp({
        content: parts[index],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
