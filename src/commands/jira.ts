import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createIssue,
  getJiraClient,
  listIssues,
  listProjects,
  searchIssues,
} from '../integrations/jira';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_PROJECT_KEY_LENGTH = 50;
const MAX_SUMMARY_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_JQL_LENGTH = 1000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Jira認証情報が未設定です')
    .setDescription('/vault set で jira_host, jira_email, jira_token を設定してください')
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const jiraCommand = {
  data: new SlashCommandBuilder()
    .setName('jira')
    .setDescription('Jiraのprojectとissueを操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('issues')
        .setDescription('最近更新されたissueを表示します')
        .addStringOption((option) =>
          option
            .setName('project')
            .setDescription('Jira project key')
            .setRequired(false)
            .setMaxLength(MAX_PROJECT_KEY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Jira issueを作成します')
        .addStringOption((option) =>
          option
            .setName('project')
            .setDescription('Jira project key')
            .setRequired(true)
            .setMaxLength(MAX_PROJECT_KEY_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('summary')
            .setDescription('issueのsummary')
            .setRequired(true)
            .setMaxLength(MAX_SUMMARY_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('issueのdescription')
            .setRequired(false)
            .setMaxLength(MAX_DESCRIPTION_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('projects').setDescription('利用可能なproject一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('JQLでissueを検索します')
        .addStringOption((option) =>
          option
            .setName('jql')
            .setDescription('JQL')
            .setRequired(true)
            .setMaxLength(MAX_JQL_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const host = vaultService.getCredential(userId, 'user', 'jira_host');
      const email = vaultService.getCredential(userId, 'user', 'jira_email');
      const token = vaultService.getCredential(userId, 'user', 'jira_token');

      if (!host || !email || !token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const client = getJiraClient(host, email, token);
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'issues') {
        const project = interaction.options.getString('project')?.trim();
        const issues = await listIssues(client, project);
        const embed = new EmbedBuilder()
          .setTitle(project ? `Jira Issues: ${project}` : 'Jira Issues')
          .setColor(0x0052cc);

        if (issues.length === 0) {
          embed.setDescription('issueは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              issues.map(
                (issue) =>
                  `**${issue.key}** ${issue.summary}\n状態: ${issue.status} / 担当: ${issue.assignee ?? '未設定'} / 優先度: ${issue.priority ?? '未設定'}\n${issue.url}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create') {
        const projectKey = interaction.options.getString('project', true).trim();
        const summary = interaction.options.getString('summary', true).trim();
        const description = interaction.options.getString('description')?.trim();
        const issue = await createIssue(client, host, {
          projectKey,
          summary,
          description,
        });

        const embed = new EmbedBuilder()
          .setTitle('Jira issueを作成しました')
          .setColor(0x0052cc)
          .addFields(
            { name: 'Key', value: issue.key, inline: true },
            { name: 'ID', value: issue.id, inline: true },
            { name: 'URL', value: issue.url, inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'projects') {
        const projects = await listProjects(client);
        const embed = new EmbedBuilder().setTitle('Jira Projects').setColor(0x0052cc);

        if (projects.length === 0) {
          embed.setDescription('projectは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              projects.map((project) => `**${project.key}** ${project.name}\nID: ${project.id}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const jql = interaction.options.getString('jql', true).trim();
      const issues = await searchIssues(client, host, jql);
      const embed = new EmbedBuilder()
        .setTitle('Jira Search')
        .setColor(0x0052cc)
        .addFields({ name: 'JQL', value: truncate(jql, 1024), inline: false });

      if (issues.length === 0) {
        embed.setDescription('一致するissueは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            issues.map(
              (issue) => `**${issue.key}** ${issue.summary}\n状態: ${issue.status}\n${issue.url}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Jira連携の処理中にエラーが発生しました。');

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
