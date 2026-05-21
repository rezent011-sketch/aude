import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createItem, getBoards, getItems } from '../integrations/monday';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Monday.com APIトークンが未設定です')
    .setDescription('/vault set key:monday_api_token value:<token> を実行してください')
    .setColor(0xff3d57);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const mondayCommand = {
  data: new SlashCommandBuilder()
    .setName('monday')
    .setDescription('Monday.comのボード・アイテムを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('boards').setDescription('ボード一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('items')
        .setDescription('アイテム一覧を表示します')
        .addStringOption((option) =>
          option.setName('board_id').setDescription('Board ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('アイテムを作成します')
        .addStringOption((option) =>
          option.setName('board_id').setDescription('Board ID').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('item_name').setDescription('アイテム名').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'monday_api_token');

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
        const embed = new EmbedBuilder().setTitle('Monday.com Boards').setColor(0xff3d57);

        if (boards.length === 0) {
          embed.setDescription('ボードは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              boards.map((board) => `**${board.name}**\nID: ${board.id}\nState: ${board.state}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'items') {
        const boardId = interaction.options.getString('board_id', true).trim();
        const items = await getItems(token, boardId);
        const embed = new EmbedBuilder()
          .setTitle('Monday.com Items')
          .setColor(0xff3d57)
          .addFields({ name: 'Board ID', value: boardId, inline: true });

        if (items.length === 0) {
          embed.setDescription('アイテムは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              items.map((item) => `**${item.name}**\nID: ${item.id}\nState: ${item.state}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const boardId = interaction.options.getString('board_id', true).trim();
      const itemName = interaction.options.getString('item_name', true).trim();
      const item = await createItem(token, boardId, itemName);
      const embed = new EmbedBuilder()
        .setTitle('Monday.comアイテムを作成しました')
        .setColor(0xff3d57)
        .addFields(
          { name: 'Board ID', value: boardId, inline: true },
          { name: 'Item ID', value: item.id || '-', inline: true },
          { name: 'Name', value: truncate(item.name, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Monday.com連携の処理中にエラーが発生しました。');

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
