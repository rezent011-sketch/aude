import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getDocument,
  getDocuments,
  sendReminder,
} from '../integrations/gmoagree';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('GMO電子印鑑 Agree APIキーが未設定です')
    .setDescription('/vault set key:gmoagree_api_key value:<api_key> を実行してください')
    .setColor(0x0040a0);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const gmoagreeCommand = {
  data: new SlashCommandBuilder()
    .setName('gmoagree')
    .setDescription('GMO電子印鑑 Agreeの契約書を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('documents').setDescription('書類一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('document')
        .setDescription('書類詳細を表示します')
        .addStringOption((option) => option.setName('id').setDescription('書類ID').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remind')
        .setDescription('署名リマインドを送信します')
        .addStringOption((option) => option.setName('id').setDescription('書類ID').setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'gmoagree_api_key');

      if (!apiKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'documents') {
        const documents = await getDocuments(apiKey);
        const embed = new EmbedBuilder().setTitle('GMO Agree 書類一覧').setColor(0x0040a0);

        if (documents.length === 0) {
          embed.setDescription('書類は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              documents.slice(0, 10).map(
                (document) =>
                  `**${document.document_name}**\nID: ${document.document_id}\nStatus: ${document.status}\nCreated: ${document.created_at || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'document') {
        const id = interaction.options.getString('id', true).trim();
        const document = await getDocument(apiKey, id);
        const embed = new EmbedBuilder()
          .setTitle(`GMO Agree 書類詳細: ${document.document_name}`)
          .setColor(0x0040a0)
          .addFields(
            { name: 'ID', value: document.document_id || id, inline: true },
            { name: 'Status', value: document.status || '-', inline: true }
          );

        if (document.signers.length === 0) {
          embed.setDescription('署名者は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              document.signers.map(
                (signer) =>
                  `**${signer.name}**\nEmail: ${signer.email}\nStatus: ${signer.status}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const id = interaction.options.getString('id', true).trim();
      await sendReminder(apiKey, id);

      const embed = new EmbedBuilder()
        .setTitle('GMO Agree 署名リマインドを送信しました')
        .setColor(0x0040a0)
        .addFields({ name: 'Document ID', value: id, inline: true });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'GMO電子印鑑 Agree連携の処理中にエラーが発生しました。');

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
