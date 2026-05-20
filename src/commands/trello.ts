import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createCard,
  getBoards,
  getCards,
  getLists,
  moveCard,
} from '../integrations/trello';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_ID_LENGTH = 100;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_DUE_LENGTH = 100;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Trello認証情報が未設定です')
    .setDescription('/vault set で trello_api_key と trello_token を設定してください')
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const trelloCommand = {
  data: new SlashCommandBuilder()
    .setName('trello')
    .setDescription('Trelloのboard、list、cardを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('boards').setDescription('board一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('lists')
        .setDescription('board内のlist一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('board_id')
            .setDescription('Trello board ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('cards')
        .setDescription('board内のcard一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('board_id')
            .setDescription('Trello board ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Trello cardを作成します')
        .addStringOption((option) =>
          option
            .setName('list_id')
            .setDescription('Trello list ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('card名')
            .setRequired(true)
            .setMaxLength(MAX_NAME_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('desc')
            .setDescription('card説明')
            .setRequired(false)
            .setMaxLength(MAX_DESCRIPTION_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('due')
            .setDescription('期限日時')
            .setRequired(false)
            .setMaxLength(MAX_DUE_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('move')
        .setDescription('cardを別のlistへ移動します')
        .addStringOption((option) =>
          option
            .setName('card_id')
            .setDescription('Trello card ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('list_id')
            .setDescription('移動先のTrello list ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const apiKey = vaultService.getCredential(userId, 'user', 'trello_api_key');
      const token = vaultService.getCredential(userId, 'user', 'trello_token');

      if (!apiKey || !token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'boards') {
        const boards = await getBoards(apiKey, token);
        const embed = new EmbedBuilder().setTitle('Trello Boards').setColor(0x0079bf);

        if (boards.length === 0) {
          embed.setDescription('boardは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              boards.map(
                (board) =>
                  `**${board.name}**\nID: ${board.id} / Closed: ${board.closed ? 'Yes' : 'No'}\n${board.url}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'lists') {
        const boardId = interaction.options.getString('board_id', true).trim();
        const lists = await getLists(apiKey, token, boardId);
        const embed = new EmbedBuilder()
          .setTitle(`Trello Lists: ${boardId}`)
          .setColor(0x0079bf);

        if (lists.length === 0) {
          embed.setDescription('listは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              lists.map(
                (list) =>
                  `**${list.name}**\nID: ${list.id} / Closed: ${list.closed ? 'Yes' : 'No'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'cards') {
        const boardId = interaction.options.getString('board_id', true).trim();
        const cards = await getCards(apiKey, token, boardId);
        const embed = new EmbedBuilder()
          .setTitle(`Trello Cards: ${boardId}`)
          .setColor(0x0079bf);

        if (cards.length === 0) {
          embed.setDescription('cardは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              cards.map(
                (card) =>
                  `**${card.name}**\nID: ${card.id} / List: ${card.idList} / Due: ${card.due ?? '未設定'}\n${truncate(card.desc || '(No description)', 200)}\n${card.url}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create') {
        const listId = interaction.options.getString('list_id', true).trim();
        const name = interaction.options.getString('name', true).trim();
        const desc = interaction.options.getString('desc')?.trim();
        const due = interaction.options.getString('due')?.trim();
        const card = await createCard(apiKey, token, {
          idList: listId,
          name,
          desc,
          due,
        });

        const embed = new EmbedBuilder()
          .setTitle('Trello cardを作成しました')
          .setColor(0x0079bf)
          .addFields(
            { name: 'ID', value: card.id, inline: true },
            { name: 'Name', value: card.name, inline: false },
            { name: 'URL', value: card.url, inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const cardId = interaction.options.getString('card_id', true).trim();
      const listId = interaction.options.getString('list_id', true).trim();
      const card = await moveCard(apiKey, token, cardId, listId);
      const embed = new EmbedBuilder()
        .setTitle('Trello cardを移動しました')
        .setColor(0x0079bf)
        .addFields(
          { name: 'ID', value: card.id, inline: true },
          { name: 'Name', value: card.name, inline: false },
          { name: 'List ID', value: listId, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Trello連携の処理中にエラーが発生しました。');

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
