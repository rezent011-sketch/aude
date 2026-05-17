// src/commands/task.ts -- /task command: run any task via LLM
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { routeToLLM } from '../llm/router';
import { splitMessage, formatElapsed } from '../utils/discord';

export const taskCommand = {
  data: new SlashCommandBuilder()
    .setName('task')
    .setDescription('Give Aude a task to complete')
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('What do you want Aude to do?')
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addStringOption((option) =>
      option
        .setName('model')
        .setDescription('Which AI model to use (default: auto)')
        .setRequired(false)
        .addChoices(
          { name: 'Auto (recommended)', value: 'auto' },
          { name: 'Claude', value: 'claude' },
          { name: 'GPT-4o', value: 'gpt4o' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const description = interaction.options.getString('description', true);
    const model = (interaction.options.getString('model') ?? 'auto') as 'auto' | 'claude' | 'gpt4o';

    await interaction.deferReply();

    const startTime = Date.now();

    const prompt = `Task: ${description}

Please complete this task thoroughly and return the results.`;

    try {
      const result = await routeToLLM(prompt, model, undefined, interaction.channelId);
      const elapsed = formatElapsed(startTime);
      const parts = splitMessage(result);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Task Complete')
        .setDescription(parts[0])
        .setFooter({ text: `Completed in ${elapsed}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Send overflow parts as follow-ups
      for (let i = 1; i < parts.length; i++) {
        await interaction.followUp({ content: parts[i] });
      }
    } catch (error) {
      console.error('Error in /task command:', error);
      await interaction.editReply(
        error instanceof Error && error.message
          ? error.message
          : 'タスクの実行に失敗しました。設定と入力内容を確認してください。'
      );
    }
  },
};
