import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { generateUsageReport } from '../services/fileExports';
import { deleteTempFile } from '../files/tempFiles';

export const reportCommand = {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('自分の利用レポートをPDFで出力します'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const discordId = interaction.user.id;
    const username = interaction.user.username;

    await interaction.deferReply({ ephemeral: true });

    const generatedFile = await generateUsageReport(discordId, username);

    try {
      const attachment = new AttachmentBuilder(generatedFile.path, {
        name: generatedFile.name,
      });

      await interaction.editReply({
        content: '利用レポートをPDFで生成しました。',
        files: [attachment],
      });
    } finally {
      await deleteTempFile(generatedFile.path);
    }
  },
};
