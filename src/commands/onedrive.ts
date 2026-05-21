import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { listFiles, searchFiles } from '../integrations/onedrive';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_FOLDER_ID_LENGTH = 200;
const MAX_QUERY_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('OneDriveアクセストークンが未設定です')
    .setDescription('/vault set key:onedrive_access_token value:... を実行してください')
    .setColor(0x0078d4);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const onedriveCommand = {
  data: new SlashCommandBuilder()
    .setName('onedrive')
    .setDescription('OneDriveのファイルを管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('files')
        .setDescription('フォルダ内のファイル一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('folder_id')
            .setDescription('OneDrive folder ID。未指定時はroot')
            .setRequired(false)
            .setMaxLength(MAX_FOLDER_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('ファイルを検索します')
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
      const token = vaultService.getCredential(interaction.user.id, 'user', 'onedrive_access_token');

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
          .setTitle(folderId ? `OneDrive Files: ${folderId}` : 'OneDrive Files')
          .setColor(0x0078d4);

        if (files.length === 0) {
          embed.setDescription('ファイルは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              files.map(
                (file) =>
                  `**${file.name}**\nID: ${file.id}\nType: ${file.isFolder ? 'folder' : 'file'} / Size: ${file.size} bytes\nModified: ${file.lastModifiedDateTime || '-'}\nURL: ${file.webUrl || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const query = interaction.options.getString('query', true).trim();
      const results = await searchFiles(token, query);
      const embed = new EmbedBuilder()
        .setTitle('OneDrive Search')
        .setColor(0x0078d4)
        .addFields({ name: 'Query', value: query, inline: false });

      if (results.length === 0) {
        embed.setDescription('一致するファイルは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            results.map((item) => `**${item.name}**\nID: ${item.id}\nURL: ${item.webUrl || '-'}`)
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'OneDrive連携の処理中にエラーが発生しました。');

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
