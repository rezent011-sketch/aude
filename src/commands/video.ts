// src/commands/video.ts — /video コマンド (Kling v2.1)
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { generateVideo, imageToVideo } from '../integrations/fal';

export const videoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('video')
    .setDescription('AIで動画を生成します (Kling v2.1)')
    .addStringOption((o) =>
      o.setName('prompt').setDescription('生成したい動画の説明').setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName('duration')
        .setDescription('動画の長さ（秒）: 5 or 10 (デフォルト: 5)')
        .setRequired(false)
        .addChoices(
          { name: '5秒', value: 5 },
          { name: '10秒', value: 10 }
        )
    )
    .addStringOption((o) =>
      o
        .setName('ratio')
        .setDescription('アスペクト比 (デフォルト: 16:9)')
        .setRequired(false)
        .addChoices(
          { name: '16:9 (横長)', value: '16:9' },
          { name: '9:16 (縦長/スマホ)', value: '9:16' },
          { name: '1:1 (正方形)', value: '1:1' }
        )
    )
    .addStringOption((o) =>
      o
        .setName('image_url')
        .setDescription('画像URLを指定すると画像→動画モードになります')
        .setRequired(false)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const prompt = interaction.options.getString('prompt', true);
    const duration = (interaction.options.getInteger('duration') ?? 5) as 5 | 10;
    const ratio = (interaction.options.getString('ratio') ?? '16:9') as '16:9' | '9:16' | '1:1';
    const imageUrl = interaction.options.getString('image_url') ?? null;

    await interaction.deferReply();

    const modeLabel = imageUrl ? '画像→動画' : 'テキスト→動画';
    await interaction.editReply(
      `🎬 動画を生成中です... (${modeLabel} / ${duration}秒 / ${ratio})\n⏳ 約1〜2分かかります。`
    );

    try {
      const result = imageUrl
        ? await imageToVideo(imageUrl, prompt, duration)
        : await generateVideo(prompt, duration, ratio);

      await interaction.editReply(
        '🎬 **動画生成完了！**\n' +
          '> ' + prompt + '\n' +
          ' | Kling v2.1\n\n' +
          '🔗 ' + result.url
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await interaction.editReply(`❌ 動画生成に失敗しました: ${msg}`);
    }
  },
};
