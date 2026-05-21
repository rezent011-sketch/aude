import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getVideo, getVideos } from '../integrations/loom';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Loomアクセストークンが未設定です')
    .setDescription('/vault set key:loom_access_token value:<token> を実行してください')
    .setColor(0x625df5);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const loomCommand = {
  data: new SlashCommandBuilder()
    .setName('loom')
    .setDescription('Loomの録画動画を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('videos').setDescription('動画一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('video')
        .setDescription('動画情報を取得します')
        .addStringOption((option) =>
          option.setName('id').setDescription('Loom video ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'loom_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'videos') {
        const videos = await getVideos(token);
        const embed = new EmbedBuilder().setTitle('Loom Videos').setColor(0x625df5);

        if (videos.length === 0) {
          embed.setDescription('動画は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              videos.map(
                (video) =>
                  `**${video.title}**\nID: ${video.id}\nDuration: ${video.duration}\nCreated: ${video.created_at || '-'}\nShare URL: ${video.share_url || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const videoId = interaction.options.getString('id', true).trim();
      const video = await getVideo(token, videoId);
      const embed = new EmbedBuilder()
        .setTitle('Loom Video')
        .setColor(0x625df5)
        .addFields(
          { name: 'ID', value: video.id || '-', inline: false },
          { name: 'Title', value: video.title || '-', inline: false },
          { name: 'Duration', value: String(video.duration), inline: true },
          { name: 'Views', value: String(video.view_count), inline: true },
          { name: 'Share URL', value: truncate(video.share_url || '-', 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Loom連携の処理中にエラーが発生しました。');

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `⚠️ ${message}` });
        return;
      }

      await interaction.reply({
        content: `⚠️ ${message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
