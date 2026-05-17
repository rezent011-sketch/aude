import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { generateConversationExport, type ExportFormat } from '../services/fileExports';
import { deleteTempFile } from '../files/tempFiles';

export const exportCommand = {
  data: new SlashCommandBuilder()
    .setName('export')
    .setDescription('現在のチャンネルの会話履歴をPDFまたはTXTで出力します')
    .addStringOption((option) =>
      option
        .setName('format')
        .setDescription('出力ファイル形式')
        .setRequired(true)
        .addChoices(
          { name: 'PDF', value: 'pdf' },
          { name: 'TXT', value: 'txt' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const format = interaction.options.getString('format', true) as ExportFormat;
    const channelId = interaction.channelId;

    await interaction.deferReply({ ephemeral: true });

    const generatedFile = await generateConversationExport(channelId, format);

    if (!generatedFile) {
      await interaction.editReply('このチャンネルにはエクスポートできる会話履歴がありません。');
      return;
    }

    try {
      const attachment = new AttachmentBuilder(generatedFile.path, {
        name: generatedFile.name,
      });

      await interaction.editReply({
        content: `会話履歴を ${format.toUpperCase()} で出力しました。`,
        files: [attachment],
      });
    } finally {
      await deleteTempFile(generatedFile.path);
    }
  },
};
