// src/commands/research.ts -- /research command: deep research via LLM
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { routeToLLM } from '../llm/router';
import { splitMessage, formatElapsed } from '../utils/discord';

export const researchCommand = {
  data: new SlashCommandBuilder()
    .setName('research')
    .setDescription('Research any topic in depth')
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('What topic should Aude research?')
        .setRequired(true)
        .setMaxLength(500)
    )
    .addStringOption((option) =>
      option
        .setName('depth')
        .setDescription('How deep should the research be?')
        .setRequired(false)
        .addChoices(
          { name: 'Quick summary', value: 'quick' },
          { name: 'Standard (default)', value: 'standard' },
          { name: 'Deep dive', value: 'deep' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const topic = interaction.options.getString('topic', true);
    const depth = interaction.options.getString('depth') ?? 'standard';

    await interaction.deferReply();

    const startTime = Date.now();

    const depthInstructions: Record<string, string> = {
      quick: 'Provide a concise 3-5 bullet point summary.',
      standard: 'Provide a comprehensive overview with key points, context, and insights.',
      deep: 'Provide an exhaustive analysis with background, current state, key players, trends, and actionable insights.',
    };

    const prompt = `Research topic: ${topic}

${depthInstructions[depth] ?? depthInstructions.standard}

Structure your response with clear headers and bullet points. Include specific facts, numbers, and examples where relevant.`;

    try {
      const result = await routeToLLM(prompt, 'claude');
      const elapsed = formatElapsed(startTime);
      const parts = splitMessage(result);

      const embed = new EmbedBuilder()
        .setColor(0x00b0f4)
        .setTitle(`Research: ${topic.slice(0, 200)}`)
        .setDescription(parts[0])
        .setFooter({ text: `Research completed in ${elapsed}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < parts.length; i++) {
        await interaction.followUp({ content: parts[i] });
      }
    } catch (error) {
      console.error('Error in /research command:', error);
      await interaction.editReply(
        error instanceof Error && error.message
          ? error.message
          : 'リサーチの実行に失敗しました。設定と入力内容を確認してください。'
      );
    }
  },
};
