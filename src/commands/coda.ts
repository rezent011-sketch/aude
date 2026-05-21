import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { listDocs, listRows, listTables } from '../integrations/coda';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Coda APIトークンが未設定です')
    .setDescription('/vault set key:coda_api_token value:<token> を実行してください')
    .setColor(0xe73025);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const codaCommand = {
  data: new SlashCommandBuilder()
    .setName('coda')
    .setDescription('CodaのドキュメントとテーブルをDiscordから操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('docs').setDescription('ドキュメント一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('tables')
        .setDescription('テーブル一覧を表示します')
        .addStringOption((option) =>
          option.setName('doc_id').setDescription('Coda doc ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rows')
        .setDescription('行一覧を表示します')
        .addStringOption((option) =>
          option.setName('doc_id').setDescription('Coda doc ID').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('table_id').setDescription('Coda table ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'coda_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'docs') {
        const docs = await listDocs(token);
        const embed = new EmbedBuilder().setTitle('Coda Docs').setColor(0xe73025);

        if (docs.length === 0) {
          embed.setDescription('ドキュメントは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              docs.map(
                (doc) =>
                  `**${doc.name}**\nID: ${doc.id}\nOwner: ${doc.owner || '-'}\nCreated: ${doc.createdAt || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'tables') {
        const docId = interaction.options.getString('doc_id', true).trim();
        const tables = await listTables(token, docId);
        const embed = new EmbedBuilder()
          .setTitle(`Coda Tables: ${docId}`)
          .setColor(0xe73025);

        if (tables.length === 0) {
          embed.setDescription('テーブルは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              tables.map(
                (table) =>
                  `**${table.name}**\nID: ${table.id}\nRows: ${String(table.rowCount)}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const docId = interaction.options.getString('doc_id', true).trim();
      const tableId = interaction.options.getString('table_id', true).trim();
      const rows = await listRows(token, docId, tableId);
      const embed = new EmbedBuilder()
        .setTitle(`Coda Rows: ${tableId}`)
        .setColor(0xe73025);

      if (rows.length === 0) {
        embed.setDescription('行は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            rows.map(
              (row) =>
                `**${row.name}**\nID: ${row.id}\nValues: ${truncate(JSON.stringify(row.values), 300)}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Coda連携の処理中にエラーが発生しました。');

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
