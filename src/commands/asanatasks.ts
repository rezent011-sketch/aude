import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createTask,
  getMyTasks,
  getWorkspaces,
} from '../integrations/asanatasks';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_ID_LENGTH = 200;
const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Asanaアクセストークンが未設定です')
    .setDescription('/vault set key:asana_access_token value:<your-token> を実行してください')
    .setColor(0xf06a6a);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const asanatasksCommand = {
  data: new SlashCommandBuilder()
    .setName('asanatasks')
    .setDescription('Asanaのワークスペース・自分のタスクを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('workspaces').setDescription('ワークスペース一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('mytasks')
        .setDescription('自分のタスク一覧を表示します')
        .addStringOption((option) =>
          option.setName('workspace_id').setDescription('Asana workspace ID').setRequired(true).setMaxLength(MAX_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('タスクを作成します')
        .addStringOption((option) =>
          option.setName('workspace_id').setDescription('Asana workspace ID').setRequired(true).setMaxLength(MAX_ID_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription('タスク名').setRequired(true).setMaxLength(MAX_NAME_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('notes').setDescription('説明').setRequired(false).setMaxLength(MAX_NOTES_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'asana_access_token');

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
          embed.setDescription('ワークスペースは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(workspaces.map((workspace) => `**${workspace.name}**\nID: ${workspace.gid}`))
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'mytasks') {
        const workspaceId = interaction.options.getString('workspace_id', true).trim();
        const tasks = await getMyTasks(token, workspaceId);
        const embed = new EmbedBuilder().setTitle(`Asana My Tasks: ${workspaceId}`).setColor(0xf06a6a);

        if (tasks.length === 0) {
          embed.setDescription('タスクは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              tasks.map(
                (task) =>
                  `**${task.name}**\nID: ${task.gid}\nCompleted: ${task.completed ? 'Yes' : 'No'}\nDue: ${task.due_on ?? '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const workspaceId = interaction.options.getString('workspace_id', true).trim();
      const name = interaction.options.getString('name', true).trim();
      const notes = interaction.options.getString('notes')?.trim();
      const task = await createTask(token, workspaceId, name, notes);
      const embed = new EmbedBuilder()
        .setTitle('Asanaタスクを作成しました')
        .setColor(0xf06a6a)
        .addFields(
          { name: 'ID', value: task.gid || '-', inline: true },
          { name: 'Name', value: task.name, inline: false },
          { name: 'Workspace', value: workspaceId, inline: true }
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
