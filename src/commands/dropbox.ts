import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getMetadata, listFolder, search } from '../integrations/dropbox';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_PATH_LENGTH = 500;
const MAX_QUERY_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Dropboxアクセストークンが未設定です')
    .setDescription('/vault set key:dropbox_access_token value:... を実行してください')
    .setColor(0x0061ff);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const dropboxCommand = {
  data: new SlashCommandBuilder()
    .setName('dropbox')
    .setDescription('Dropboxのファイル・フォルダを操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('フォルダ内容を表示します')
        .addStringOption((option) =>
          option
            .setName('path')
            .setDescription('Dropbox path。未指定時はroot')
            .setRequired(false)
            .setMaxLength(MAX_PATH_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('ファイル・フォルダのメタデータを取得します')
        .addStringOption((option) =>
          option
            .setName('path')
            .setDescription('Dropbox path')
            .setRequired(true)
            .setMaxLength(MAX_PATH_LENGTH)
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
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'dropbox_access_token'
      );

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'list') {
        const path = interaction.options.getString('path')?.trim();
        const entries = await listFolder(token, path);
        const embed = new EmbedBuilder()
          .setTitle(path ? `Dropbox List: ${path}` : 'Dropbox List')
          .setColor(0x0061ff);

        if (entries.length === 0) {
          embed.setDescription('項目は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              entries.map(
                (entry) =>
                  `**${entry.name}**\nPath: ${entry.path_display || '-'}\nType: ${entry.is_folder ? 'folder' : 'file'}${entry.is_folder ? '' : ` / Size: ${entry.size ?? 0} bytes`}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'info') {
        const path = interaction.options.getString('path', true).trim();
        const metadata = await getMetadata(token, path);
        const embed = new EmbedBuilder()
          .setTitle('Dropbox Metadata')
          .setColor(0x0061ff)
          .addFields(
            { name: 'ID', value: metadata.id || '-', inline: true },
            { name: 'Name', value: metadata.name || '-', inline: true },
            { name: 'Path', value: metadata.path_display || '-', inline: false },
            { name: 'Size', value: metadata.size !== undefined ? `${metadata.size} bytes` : '-', inline: true },
            { name: 'Modified', value: metadata.server_modified || '-', inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const query = interaction.options.getString('query', true).trim();
      const results = await search(token, query);
      const embed = new EmbedBuilder()
        .setTitle('Dropbox Search')
        .setColor(0x0061ff)
        .addFields({ name: 'Query', value: query, inline: false });

      if (results.length === 0) {
        embed.setDescription('一致するファイル・フォルダは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            results.map((item) => `**${item.name}**\nPath: ${item.path_display || '-'}`)
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Dropbox連携の処理中にエラーが発生しました。');

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
