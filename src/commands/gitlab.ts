import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createIssue,
  createMergeRequest,
  listIssues,
  listMergeRequests,
  listProjects,
} from '../integrations/gitlab';
import vaultService from '../services/vaultService';

const MAX_PROJECT_ID_LENGTH = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_BRANCH_LENGTH = 200;
const MAX_SEARCH_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('GitLabトークンが未設定です')
    .setDescription('/vault set key:gitlab_token value:<your-token>')
    .setColor(0xff9900);
}

export const gitlabCommand = {
  data: new SlashCommandBuilder()
    .setName('gitlab')
    .setDescription('GitLabのproject, issue, MRを操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('projects')
        .setDescription('自分のproject一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('search')
            .setDescription('project検索キーワード')
            .setRequired(false)
            .setMaxLength(MAX_SEARCH_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('mrs')
        .setDescription('merge request一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('project_id')
            .setDescription('GitLab project ID')
            .setRequired(true)
            .setMaxLength(MAX_PROJECT_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('issues')
        .setDescription('issue一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('project_id')
            .setDescription('GitLab project ID')
            .setRequired(true)
            .setMaxLength(MAX_PROJECT_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create-mr')
        .setDescription('merge requestを作成します')
        .addStringOption((option) =>
          option
            .setName('project_id')
            .setDescription('GitLab project ID')
            .setRequired(true)
            .setMaxLength(MAX_PROJECT_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('MRタイトル')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('source_branch')
            .setDescription('source branch')
            .setRequired(true)
            .setMaxLength(MAX_BRANCH_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('target_branch')
            .setDescription('target branch')
            .setRequired(true)
            .setMaxLength(MAX_BRANCH_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('MR説明')
            .setRequired(false)
            .setMaxLength(MAX_DESCRIPTION_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create-issue')
        .setDescription('issueを作成します')
        .addStringOption((option) =>
          option
            .setName('project_id')
            .setDescription('GitLab project ID')
            .setRequired(true)
            .setMaxLength(MAX_PROJECT_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('issueタイトル')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('issue説明')
            .setRequired(false)
            .setMaxLength(MAX_DESCRIPTION_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'gitlab_token');

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
        const search = interaction.options.getString('search')?.trim();
        const projects = await listProjects(token, search);
        const embed = new EmbedBuilder().setTitle('GitLab Projects').setColor(0xfc6d26);

        if (projects.length === 0) {
          embed.setDescription('projectは見つかりませんでした。');
        } else {
          embed.setDescription(
            projects
              .map(
                (project) =>
                  `**${project.name}** (#${project.id})\n${project.path}\nStars: ${project.stars}\n${project.url}`
              )
              .join('\n\n')
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'mrs') {
        const projectId = interaction.options.getString('project_id', true).trim();
        const mergeRequests = await listMergeRequests(token, projectId);
        const embed = new EmbedBuilder()
          .setTitle(`GitLab MRs: ${projectId}`)
          .setColor(0xfc6d26);

        if (mergeRequests.length === 0) {
          embed.setDescription('merge requestは見つかりませんでした。');
        } else {
          embed.setDescription(
            mergeRequests
              .map(
                (mergeRequest) =>
                  `**!${mergeRequest.id}** ${mergeRequest.title}\n状態: ${mergeRequest.state} / 作成者: ${mergeRequest.author}\n${mergeRequest.url}`
              )
              .join('\n\n')
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'issues') {
        const projectId = interaction.options.getString('project_id', true).trim();
        const issues = await listIssues(token, projectId);
        const embed = new EmbedBuilder()
          .setTitle(`GitLab Issues: ${projectId}`)
          .setColor(0xfc6d26);

        if (issues.length === 0) {
          embed.setDescription('issueは見つかりませんでした。');
        } else {
          embed.setDescription(
            issues
              .map(
                (issue) =>
                  `**#${issue.id}** ${issue.title}\n状態: ${issue.state} / 作成者: ${issue.author}\n${issue.url}`
              )
              .join('\n\n')
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create-mr') {
        const projectId = interaction.options.getString('project_id', true).trim();
        const title = interaction.options.getString('title', true).trim();
        const sourceBranch = interaction.options.getString('source_branch', true).trim();
        const targetBranch = interaction.options.getString('target_branch', true).trim();
        const description = interaction.options.getString('description')?.trim();
        const mergeRequest = await createMergeRequest(token, projectId, {
          title,
          sourceBranch,
          targetBranch,
          description,
        });

        const embed = new EmbedBuilder()
          .setTitle('GitLab MRを作成しました')
          .setColor(0xfc6d26)
          .addFields(
            { name: 'ID', value: `!${mergeRequest.id}`, inline: true },
            { name: 'Title', value: mergeRequest.title, inline: false },
            { name: 'URL', value: mergeRequest.url, inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const projectId = interaction.options.getString('project_id', true).trim();
      const title = interaction.options.getString('title', true).trim();
      const description = interaction.options.getString('description')?.trim();
      const issue = await createIssue(token, projectId, { title, description });

      const embed = new EmbedBuilder()
        .setTitle('GitLab issueを作成しました')
        .setColor(0xfc6d26)
        .addFields(
          { name: 'ID', value: `#${issue.id}`, inline: true },
          { name: 'Title', value: issue.title, inline: false },
          { name: 'URL', value: issue.url, inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'GitLab連携の処理中にエラーが発生しました。');

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
