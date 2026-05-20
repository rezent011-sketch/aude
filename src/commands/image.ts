// src/commands/image.ts — /image コマンド (FLUX.1-schnell)
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { generateImage } from '../integrations/fal';

export const imageCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('AIで画像を生成します (FLUX.1)')
    .addStringOption((o) =>
      o.setName('prompt').setDescription('生成したい画像の説明').setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('ratio')
        .setDescription('アスペクト比 (デフォルト: 1:1)')
        .setRequired(false)
        .addChoices(
          { name: '1:1 (正方形)', value: '1:1' },
          { name: '16:9 (横長)', value: '16:9' },
          { name: '9:16 (縦長/スマホ)', value: '9:16' },
          { name: '4:3', value: '4:3' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const prompt = interaction.options.getString('prompt', true);
    const ratio = (interaction.options.getString('ratio') ?? '1:1') as
      | '1:1'
      | '16:9'
      | '9:16'
      | '4:3';

    await interaction.deferReply();

    try {
      const result = await generateImage(prompt, ratio);

      // URLから画像をダウンロードしてDiscordに添付
      const response = await fetch(result.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const attachment = new AttachmentBuilder(buffer, { name: 'generated.png' });

      await interaction.editReply({
        content: `🎨 **生成完了！**\n> ${prompt}\n\`${result.width}×${result.height}\` | FLUX.1-schnell`,
        files: [attachment],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await interaction.editReply(`❌ 画像生成に失敗しました: ${msg}`);
    }
  },
};
