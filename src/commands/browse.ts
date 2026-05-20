import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { browseUrl } from '../services/webBrowser';
import { formatElapsed, splitMessage, truncate } from '../utils/discord';

const DEFAULT_TASK = 'Summarize the main content of this page';

export const browseCommand = {
  data: new SlashCommandBuilder()
    .setName('browse')
    .setDescription('Browse a URL and get AI-powered insights')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('The URL to visit')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('task')
        .setDescription('What to find or summarize')
        .setRequired(false)
        .setMaxLength(300)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const url = interaction.options.getString('url', true).trim();
    const task = interaction.options.getString('task')?.trim() || DEFAULT_TASK;
    const startTime = Date.now();

    await interaction.deferReply();

    try {
      const result = await browseUrl(url, task);
      const elapsed = formatElapsed(startTime);
      const parts = splitMessage(result.text, 4000);

      const embed = new EmbedBuilder()
        .setColor(result.error ? 0xe67e22 : 0x2ecc71)
        .setTitle(truncate(result.title, 256))
        .setDescription(parts[0])
        .setFooter({
          text: `Source: ${truncate(url, 1800)} • ${elapsed}`,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      for (let index = 1; index < parts.length; index += 1) {
        await interaction.followUp({ content: parts[index] });
      }
    } catch (error) {
      console.error('Error in /browse command:', error);
      await interaction.editReply(
        error instanceof Error && error.message
          ? error.message
          : 'ページの閲覧に失敗しました。URLと設定を確認してください。'
      );
    }
  },
};
