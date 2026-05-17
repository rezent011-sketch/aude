import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import approvalService from '../services/approvalService';
import { ModelChoice } from '../llm/router';

export const approveTaskCommand = {
  data: new SlashCommandBuilder()
    .setName('approve-task')
    .setDescription('承認フロー付きでタスク実行を申請します')
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('実行したいタスク内容')
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addStringOption((option) =>
      option
        .setName('model')
        .setDescription('利用するモデル')
        .setRequired(false)
        .addChoices(
          { name: 'Auto (recommended)', value: 'auto' },
          { name: 'Claude', value: 'claude' },
          { name: 'GPT-4o', value: 'gpt4o' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({
        content: 'このコマンドはサーバーチャンネルでのみ利用できます。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const description = interaction.options.getString('description', true).trim();
    const model = (interaction.options.getString('model') ?? 'auto') as ModelChoice;

    await approvalService.createApprovalRequest(interaction, {
      description,
      model,
    });
  },
};
