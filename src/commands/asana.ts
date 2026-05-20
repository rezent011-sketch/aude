import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  completeTask,
  createTask,
  getProjects,
  getTasks,
  getWorkspaces,
} from '../integrations/asana';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_ID_LENGTH = 100;
const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 4000;
const MAX_DUE_LENGTH = 20;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Asana認証情報が未設定です')
    .setDescription('/vault set key:asana_token value:<your-token> を実行してください')
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const asanaCommand = {
  data: new SlashCommandBuilder()
    .setName('asana')
    .setDescription('Asanaのworkspace、project、taskを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('workspaces').setDescription('workspace一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('projects')
        .setDescription('workspace内のproject一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('workspace_id')
            .setDescription('Asana workspace ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('tasks')
        .setDescription('project内のtask一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('project_id')
            .setDescription('Asana project ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Asana taskを作成します')
        .addStringOption((option) =>
          option
            .setName('workspace_id')
            .setDescription('Asana workspace ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('task名')
            .setRequired(true)
            .setMaxLength(MAX_NAME_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('notes')
            .setDescription('task説明')
            .setRequired(false)
            .setMaxLength(MAX_NOTES_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('due')
            .setDescription('期限日 (例: 2026-06-01)')
            .setRequired(false)
            .setMaxLength(MAX_DUE_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('complete')
        .setDescription('taskを完了にします')
        .addStringOption((option) =>
          option
            .setName('task_id')
            .setDescription('Asana task ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'asana_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'workspaces') {
        const workspaces = await getWorkspaces(token);
        const embed = new EmbedBuilder().setTitle('Asana Workspaces').setColor(0xf06a6a);

        if (workspaces.length === 0) {
          embed.setDescription('workspaceは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              workspaces.map((workspace) => `**${workspace.name}**\nID: ${workspace.gid}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'projects') {
        const workspaceId = interaction.options.getString('workspace_id', true).trim();
        const projects = await getProjects(token, workspaceId);
        const embed = new EmbedBuilder()
          .setTitle(`Asana Projects: ${workspaceId}`)
          .setColor(0xf06a6a);

        if (projects.length === 0) {
          embed.setDescription('projectは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              projects.map(
                (project) =>
                  `**${project.name}**\nID: ${project.gid} / Archived: ${project.archived ? 'Yes' : 'No'}\n${project.permalink_url ?? 'URLなし'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'tasks') {
        const projectId = interaction.options.getString('project_id', true).trim();
        const tasks = await getTasks(token, projectId);
        const embed = new EmbedBuilder()
          .setTitle(`Asana Tasks: ${projectId}`)
          .setColor(0xf06a6a);

        if (tasks.length === 0) {
          embed.setDescription('taskは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              tasks.map(
                (task) =>
                  `**${task.name}**\nID: ${task.gid} / Completed: ${task.completed ? 'Yes' : 'No'} / Due: ${task.due_on ?? '未設定'} / Assignee: ${task.assignee ?? '未設定'}\n${task.permalink_url ?? 'URLなし'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create') {
        const workspaceId = interaction.options.getString('workspace_id', true).trim();
        const name = interaction.options.getString('name', true).trim();
        const notes = interaction.options.getString('notes')?.trim();
        const due = interaction.options.getString('due')?.trim();
        const task = await createTask(token, {
          workspace: workspaceId,
          name,
          notes,
          due_on: due,
        });

        const embed = new EmbedBuilder()
          .setTitle('Asana taskを作成しました')
          .setColor(0xf06a6a)
          .addFields(
            { name: 'ID', value: task.gid, inline: true },
            { name: 'Name', value: task.name, inline: false },
            { name: 'URL', value: task.permalink_url ?? 'URLなし', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const taskId = interaction.options.getString('task_id', true).trim();
      const task = await completeTask(token, taskId);
      const embed = new EmbedBuilder()
        .setTitle('Asana taskを完了にしました')
        .setColor(0xf06a6a)
        .addFields(
          { name: 'ID', value: task.gid, inline: true },
          { name: 'Name', value: task.name, inline: false },
          { name: 'Completed', value: task.completed ? 'Yes' : 'No', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Asana連携の処理中にエラーが発生しました。');

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
