// src/commands/create.ts -- /create command: generate content via LLM
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { routeToLLM } from '../llm/router';
import { splitMessage, formatElapsed } from '../utils/discord';

export const createCommand = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create content, documents, or creative work')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('What type of content to create')
        .setRequired(true)
        .addChoices(
          { name: 'Blog post', value: 'blog' },
          { name: 'Landing page copy', value: 'landing' },
          { name: 'Email', value: 'email' },
          { name: 'Social media post', value: 'social' },
          { name: 'Report / Document', value: 'report' },
          { name: 'Other', value: 'other' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Describe what you want created')
        .setRequired(true)
        .setMaxLength(800)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const type = interaction.options.getString('type', true);
    const description = interaction.options.getString('description', true);

    await interaction.deferReply();

    const startTime = Date.now();

    const typeLabels: Record<string, string> = {
      blog: 'blog post',
      landing: 'landing page copy',
      email: 'email',
      social: 'social media post',
      report: 'report/document',
      other: 'content',
    };

    const prompt = `Create a ${typeLabels[type] ?? 'piece of content'} based on the following:

${description}

Write it in full, ready to use. Format appropriately for the content type.`;

    try {
      const result = await routeToLLM(prompt, 'claude');
      const elapsed = formatElapsed(startTime);
      const parts = splitMessage(result);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`Created: ${typeLabels[type] ?? 'Content'}`)
        .setDescription(parts[0])
        .setFooter({ text: `Created in ${elapsed}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < parts.length; i++) {
        await interaction.followUp({ content: parts[i] });
      }
    } catch (error) {
      console.error('Error in /create command:', error);
      await interaction.editReply(
        'Failed to create content. Please check your API keys and try again.'
      );
    }
  },
};
