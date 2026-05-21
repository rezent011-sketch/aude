import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { createTask, getSpaces, getTasks } from '../integrations/clickup';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('ClickUp APIトークンが未設定です')
    .setDescription('/vault set key:clickup_api_token value:<token> を実行してください')
    .setColor(0x7b68ee);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const clickupCommand = {
  data: new SlashCommandBuilder()
    .setName('clickup')
    .setDescription('ClickUpのタスク・スペースを管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('spaces')
        .setDescription('スペース一覧を表示します')
        .addStringOption((option) =>
          option.setName('team_id').setDescription('Team ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('tasks')
        .setDescription('タスク一覧を表示します')
        .addStringOption((option) =>
          option.setName('list_id').setDescription('List ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('タスクを作成します')
        .addStringOption((option) =>
          option.setName('list_id').setDescription('List ID').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription('タスク名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('description').setDescription('説明').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'clickup_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'spaces') {
        const teamId = interaction.options.getString('team_id', true).trim();
        const spaces = await getSpaces(token, teamId);
        const embed = new EmbedBuilder()
          .setTitle('ClickUp Spaces')
          .setColor(0x7b68ee)
          .addFields({ name: 'Team ID', value: teamId, inline: true });

        if (spaces.length === 0) {
          embed.setDescription('スペースは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              spaces.map((space) => `**${space.name}**\nID: ${space.id}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'tasks') {
        const listId = interaction.options.getString('list_id', true).trim();
        const tasks = await getTasks(token, listId);
        const embed = new EmbedBuilder()
          .setTitle('ClickUp Tasks')
          .setColor(0x7b68ee)
          .addFields({ name: 'List ID', value: listId, inline: true });

        if (tasks.length === 0) {
          embed.setDescription('タスクは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              tasks.map(
                (task) =>
                  `**${task.name}**\nID: ${task.id}\nStatus: ${task.status}\nAssignees: ${task.assignees.join(', ') || '-'}\nDue: ${task.due_date || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const listId = interaction.options.getString('list_id', true).trim();
      const name = interaction.options.getString('name', true).trim();
      const description = interaction.options.getString('description')?.trim();
      const task = await createTask(token, listId, name, description);
      const embed = new EmbedBuilder()
        .setTitle('ClickUpタスクを作成しました')
        .setColor(0x7b68ee)
        .addFields(
          { name: 'List ID', value: listId, inline: true },
          { name: 'Task ID', value: task.id || '-', inline: true },
          { name: 'Name', value: truncate(task.name, 1024), inline: false },
          { name: 'URL', value: truncate(task.url || '-', 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'ClickUp連携の処理中にエラーが発生しました。');

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
