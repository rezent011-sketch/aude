import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getFile, listFiles, searchFiles } from '../integrations/box';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_FOLDER_ID_LENGTH = 100;
const MAX_FILE_ID_LENGTH = 100;
const MAX_QUERY_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Boxアクセストークンが未設定です')
    .setDescription('/vault set key:box_access_token value:... を実行してください')
    .setColor(0x0061d5);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const boxCommand = {
  data: new SlashCommandBuilder()
    .setName('box')
    .setDescription('Boxのファイル・フォルダを管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('files')
        .setDescription('フォルダ内のファイル一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('folder_id')
            .setDescription('Box folder ID。未指定時はroot')
            .setRequired(false)
            .setMaxLength(MAX_FOLDER_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('file')
        .setDescription('ファイル情報を取得します')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('Box file ID')
            .setRequired(true)
            .setMaxLength(MAX_FILE_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('ファイル・フォルダを検索します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('検索キーワード')
            .setRequired(true)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'box_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'files') {
        const folderId = interaction.options.getString('folder_id')?.trim();
        const files = await listFiles(token, folderId);
        const embed = new EmbedBuilder()
          .setTitle(folderId ? `Box Files: ${folderId}` : 'Box Files')
          .setColor(0x0061d5);

        if (files.length === 0) {
          embed.setDescription('ファイルは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              files.map(
                (file) =>
                  `**${file.name}**\nID: ${file.id}\nType: ${file.type} / Size: ${file.size} bytes\nModified: ${file.modified_at || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'file') {
        const fileId = interaction.options.getString('id', true).trim();
        const file = await getFile(token, fileId);
        const embed = new EmbedBuilder()
          .setTitle('Box File')
          .setColor(0x0061d5)
          .addFields(
            { name: 'ID', value: file.id || '-', inline: true },
            { name: 'Name', value: file.name || '-', inline: true },
            { name: 'Size', value: `${file.size} bytes`, inline: true },
            { name: 'Download URL', value: file.download_url || '-', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const query = interaction.options.getString('query', true).trim();
      const results = await searchFiles(token, query);
      const embed = new EmbedBuilder()
        .setTitle('Box Search')
        .setColor(0x0061d5)
        .addFields({ name: 'Query', value: query, inline: false });

      if (results.length === 0) {
        embed.setDescription('一致するファイル・フォルダは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            results.map(
              (item) =>
                `**${item.name}**\nID: ${item.id}\nType: ${item.type} / Parent: ${item.parent_name}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Box連携の処理中にエラーが発生しました。');

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
