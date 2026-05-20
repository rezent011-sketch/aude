// src/commands/website.ts — /website コマンド
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { generateWebsiteHTML, deployToNetlify, PageType } from '../services/websiteBuilder';

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  'video-bg': '動画背景LP',
  animation: 'アニメーションLP',
  gradient: 'グラデーションLP',
  saas: 'SaaS LP（ダーク）',
  minimal: 'ミニマルLP',
};

export const websiteCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('website')
    .setDescription('AIでホームページ/LPを生成してNetlifyに公開します')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('ホームページ/LPを生成して公開')
        .addStringOption((o) =>
          o.setName('name').setDescription('ビジネス名（例: Aude AI）').setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('description')
            .setDescription('ビジネスの説明（例: DiscordにいるAI社員）')
            .setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('デザインタイプ')
            .setRequired(true)
            .addChoices(
              { name: '動画背景LP', value: 'video-bg' },
              { name: 'アニメーションLP (particles.js)', value: 'animation' },
              { name: 'グラデーションLP', value: 'gradient' },
              { name: 'SaaS LP（Linear/Stripe風）', value: 'saas' },
              { name: 'ミニマルLP（Apple風）', value: 'minimal' }
            )
        )
        .addStringOption((o) =>
          o
            .setName('color')
            .setDescription('アクセントカラー（例: #6C63FF）デフォルト: #6C63FF')
            .setRequired(false)
        )
        .addStringOption((o) =>
          o
            .setName('video_url')
            .setDescription('動画背景URL（type: video-bg の場合）')
            .setRequired(false)
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    if (sub !== 'create') {
      await interaction.reply({ content: '未知のサブコマンドです。', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('name', true);
    const description = interaction.options.getString('description', true);
    const pageType = interaction.options.getString('type', true) as PageType;
    const color = interaction.options.getString('color') ?? '#6C63FF';
    const videoUrl = interaction.options.getString('video_url') ?? undefined;

    await interaction.deferReply();

    try {
      await interaction.editReply(
        `🔨 **${name}** のLP生成中...\n⏳ AIがHTMLを書いています（30〜60秒）`
      );

      const html = await generateWebsiteHTML(name, description, pageType, color, videoUrl);

      if (!process.env.NETLIFY_TOKEN) {
        // Netlifyトークン未設定の場合はHTMLをファイルで返す
        await interaction.editReply(
          '⚠️ NETLIFY_TOKEN が未設定のためデプロイできません。\n管理者に `NETLIFY_TOKEN` の設定を依頼してください。'
        );
        return;
      }

      await interaction.editReply(
        `🚀 **${name}** のLPをNetlifyにデプロイ中...\n⏳ もう少しお待ちください`
      );

      const { url } = await deployToNetlify(html, name);

      await interaction.editReply(
        [
          `🌐 **${name} のサイトが完成しました！**`,
          `🔗 ${url}`,
          '',
          `📐 タイプ: ${PAGE_TYPE_LABELS[pageType]}`,
          `🎨 カラー: ${color}`,
          '',
          'Powered by Aude AI 🤖',
        ].join('\n')
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await interaction.editReply(`❌ エラーが発生しました: ${msg}`);
    }
  },
};
