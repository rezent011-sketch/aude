// src/commands/code.ts -- /code command: write and explain code via LLM
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { routeToLLM } from '../llm/router';
import { splitMessage, formatElapsed } from '../utils/discord';

export const codeCommand = {
  data: new SlashCommandBuilder()
    .setName('code')
    .setDescription('Write, review, or debug code')
    .addStringOption((option) =>
      option
        .setName('task')
        .setDescription('What code task should Aude do?')
        .setRequired(true)
        .setMaxLength(800)
    )
    .addStringOption((option) =>
      option
        .setName('language')
        .setDescription('Programming language (optional)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const task = interaction.options.getString('task', true);
    const language = interaction.options.getString('language') ?? '';

    await interaction.deferReply();

    const startTime = Date.now();

    const languageHint = language ? `Language: ${language}\n\n` : '';

    const prompt = `${languageHint}Code task: ${task}\n\nProvide working, well-commented code. Use Discord markdown code blocks. Explain key decisions briefly.`;

    try {
      const result = await routeToLLM(prompt, 'gpt4o');
      const elapsed = formatElapsed(startTime);
      const parts = splitMessage(result);

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('Code Ready')
        .setDescription(parts[0])
        .setFooter({ text: `Generated in ${elapsed}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < parts.length; i++) {
        await interaction.followUp({ content: parts[i] });
      }
    } catch (error) {
      console.error('Error in /code command:', error);
      await interaction.editReply(
        'Failed to generate code. Please check your API keys and try again.'
      );
    }
  },
};
