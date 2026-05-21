import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createStickyNote, getBoard, getBoards } from '../integrations/miro';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Miroアクセストークンが未設定です')
    .setDescription('/vault set key:miro_access_token value:<token> を実行してください')
    .setColor(0xffd02f);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const miroCommand = {
  data: new SlashCommandBuilder()
    .setName('miro')
    .setDescription('Miroのボード・付箋を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('boards').setDescription('ボード一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('board')
        .setDescription('ボード情報を取得します')
        .addStringOption((option) =>
          option.setName('id').setDescription('Miro board ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sticky')
        .setDescription('付箋を作成します')
        .addStringOption((option) =>
          option.setName('board_id').setDescription('Miro board ID').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('content').setDescription('付箋の内容').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('color').setDescription('付箋の色').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'miro_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'boards') {
        const boards = await getBoards(token);
        const embed = new EmbedBuilder().setTitle('Miro Boards').setColor(0xffd02f);

        if (boards.length === 0) {
          embed.setDescription('ボードは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              boards.map(
                (board) =>
                  `**${board.name}**\nID: ${board.id}\nDescription: ${board.description || '-'}\nView: ${board.viewLink || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'board') {
        const boardId = interaction.options.getString('id', true).trim();
        const board = await getBoard(token, boardId);
        const embed = new EmbedBuilder()
          .setTitle('Miro Board')
          .setColor(0xffd02f)
          .addFields(
            { name: 'ID', value: board.id || '-', inline: false },
            { name: 'Name', value: board.name || '-', inline: true },
            { name: 'Collaborators', value: String(board.collaborators), inline: true },
            { name: 'Created', value: board.createdAt || '-', inline: false },
            { name: 'Modified', value: board.modifiedAt || '-', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const boardId = interaction.options.getString('board_id', true).trim();
      const content = interaction.options.getString('content', true).trim();
      const color = interaction.options.getString('color')?.trim() || undefined;
      const stickyNote = await createStickyNote(token, boardId, content, color);
      const embed = new EmbedBuilder()
        .setTitle('Miroに付箋を作成しました')
        .setColor(0xffd02f)
        .addFields(
          { name: 'Board ID', value: boardId, inline: false },
          { name: 'Sticky Note ID', value: stickyNote.id || '-', inline: false },
          { name: 'Color', value: color || 'light_yellow', inline: true },
          { name: 'Content', value: truncate(stickyNote.content || content, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Miro連携の処理中にエラーが発生しました。');

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
