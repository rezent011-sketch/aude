import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createIssue,
  listIssues,
  listPriorities,
  listProjects,
} from '../integrations/backlog';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_SUMMARY_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Backlog認証情報が未設定です')
    .setDescription('/vault set で backlog_api_key と backlog_space を設定してください')
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const backlogCommand = {
  data: new SlashCommandBuilder()
    .setName('backlog')
    .setDescription('Backlogのprojectとissueを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('projects').setDescription('project一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('issues')
        .setDescription('最近のissueを表示します')
        .addIntegerOption((option) =>
          option
            .setName('project_id')
            .setDescription('Backlog project ID')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Backlog issueを作成します')
        .addIntegerOption((option) =>
          option
            .setName('project_id')
            .setDescription('Backlog project ID')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('summary')
            .setDescription('issue summary')
            .setRequired(true)
            .setMaxLength(MAX_SUMMARY_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('issue_type_id')
            .setDescription('issue type ID')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('issue description')
            .setRequired(false)
            .setMaxLength(MAX_DESCRIPTION_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('priorities').setDescription('priority一覧を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const apiKey = vaultService.getCredential(userId, 'user', 'backlog_api_key');
      const space = vaultService.getCredential(userId, 'user', 'backlog_space');

      if (!apiKey || !space) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'projects') {
        const projects = await listProjects(apiKey, space);
        const embed = new EmbedBuilder().setTitle('Backlog Projects').setColor(0x42ce9f);

        if (projects.length === 0) {
          embed.setDescription('projectは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              projects.map(
                (project) =>
                  `**${project.projectKey}** ${project.name}\nID: ${project.id} / Archived: ${project.archived ? 'Yes' : 'No'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'issues') {
        const projectId = interaction.options.getInteger('project_id') ?? undefined;
        const issues = await listIssues(apiKey, space, projectId);
        const embed = new EmbedBuilder()
          .setTitle(projectId ? `Backlog Issues: ${projectId}` : 'Backlog Issues')
          .setColor(0x42ce9f);

        if (issues.length === 0) {
          embed.setDescription('issueは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              issues.map(
                (issue) =>
                  `**${issue.issueKey}** ${issue.summary}\n状態: ${issue.status} / 担当: ${issue.assignee ?? '未設定'} / 優先度: ${issue.priority ?? '未設定'}\n${issue.url}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create') {
        const projectId = interaction.options.getInteger('project_id', true);
        const summary = interaction.options.getString('summary', true).trim();
        const issueTypeId = interaction.options.getInteger('issue_type_id', true);
        const description = interaction.options.getString('description')?.trim();
        const issue = await createIssue(apiKey, space, {
          projectId,
          summary,
          issueTypeId,
          description,
        });

        const embed = new EmbedBuilder()
          .setTitle('Backlog issueを作成しました')
          .setColor(0x42ce9f)
          .addFields(
            { name: 'Key', value: issue.issueKey, inline: true },
            { name: 'ID', value: String(issue.id), inline: true },
            { name: 'URL', value: issue.url, inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const priorities = await listPriorities(apiKey, space);
      const embed = new EmbedBuilder().setTitle('Backlog Priorities').setColor(0x42ce9f);

      if (priorities.length === 0) {
        embed.setDescription('priorityは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            priorities.map((priority) => `**${priority.name}**\nID: ${priority.id}`)
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Backlog連携の処理中にエラーが発生しました。');

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
