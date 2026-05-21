import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getFileComments,
  getProjectFiles,
  getTeamProjects,
} from '../integrations/figmafiles';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_ID_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Figmaアクセストークンが未設定です')
    .setDescription('/vault set key:figma_access_token value:<your-token> を実行してください')
    .setColor(0xf24e1e);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const figmafilesCommand = {
  data: new SlashCommandBuilder()
    .setName('figmafiles')
    .setDescription('Figmaのプロジェクト・ファイル・コメントを管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('projects')
        .setDescription('チーム配下のプロジェクト一覧を表示します')
        .addStringOption((option) =>
          option.setName('team_id').setDescription('Figma team ID').setRequired(true).setMaxLength(MAX_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('files')
        .setDescription('プロジェクト配下のファイル一覧を表示します')
        .addStringOption((option) =>
          option.setName('project_id').setDescription('Figma project ID').setRequired(true).setMaxLength(MAX_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('comments')
        .setDescription('ファイルのコメント一覧を表示します')
        .addStringOption((option) =>
          option.setName('file_key').setDescription('Figma file key').setRequired(true).setMaxLength(MAX_ID_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'figma_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'projects') {
        const teamId = interaction.options.getString('team_id', true).trim();
        const projects = await getTeamProjects(token, teamId);
        const embed = new EmbedBuilder().setTitle(`Figma Projects: ${teamId}`).setColor(0xf24e1e);

        if (projects.length === 0) {
          embed.setDescription('プロジェクトは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(projects.map((project) => `**${project.name}**\nID: ${project.id}`))
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'files') {
        const projectId = interaction.options.getString('project_id', true).trim();
        const files = await getProjectFiles(token, projectId);
        const embed = new EmbedBuilder().setTitle(`Figma Files: ${projectId}`).setColor(0xf24e1e);

        if (files.length === 0) {
          embed.setDescription('ファイルは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              files.map((file) => `**${file.name}**\nKey: ${file.key}\nUpdated: ${file.last_modified || '-'}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const fileKey = interaction.options.getString('file_key', true).trim();
      const comments = await getFileComments(token, fileKey);
      const embed = new EmbedBuilder().setTitle(`Figma Comments: ${fileKey}`).setColor(0xf24e1e);

      if (comments.length === 0) {
        embed.setDescription('コメントは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            comments.map(
              (comment) =>
                `**${comment.user || 'unknown'}**\nID: ${comment.id}\nCreated: ${comment.created_at || '-'}\n${truncate(comment.message, 300)}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Figma連携の処理中にエラーが発生しました。');

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
