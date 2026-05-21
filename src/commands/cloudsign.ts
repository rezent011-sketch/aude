import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createDocument, getDocument, getDocuments } from '../integrations/cloudsign';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('クラウドサイン APIトークンが未設定です')
    .setDescription('/vault set key:cloudsign_api_token value:<token> を実行してください')
    .setColor(0x0066cc);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const cloudsignCommand = {
  data: new SlashCommandBuilder()
    .setName('cloudsign')
    .setDescription('クラウドサインの電子契約書を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('documents').setDescription('契約書一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('document')
        .setDescription('契約書詳細を表示します')
        .addStringOption((option) =>
          option.setName('id').setDescription('契約書ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('契約書を作成します')
        .addStringOption((option) =>
          option.setName('title').setDescription('契約書タイトル').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'cloudsign_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'documents') {
        const documents = await getDocuments(token);
        const embed = new EmbedBuilder().setTitle('クラウドサイン 契約書一覧').setColor(0x0066cc);

        if (documents.length === 0) {
          embed.setDescription('契約書は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              documents.slice(0, 10).map(
                (document) =>
                  `**${document.title}**\nID: ${document.id}\nStatus: ${document.status}\nCreated: ${document.created_at || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'document') {
        const id = interaction.options.getString('id', true).trim();
        const document = await getDocument(token, id);
        const embed = new EmbedBuilder()
          .setTitle(`クラウドサイン 契約書詳細: ${document.title}`)
          .setColor(0x0066cc)
          .addFields(
            { name: 'ID', value: document.id || id, inline: true },
            { name: 'Status', value: document.status || '-', inline: true }
          );

        if (document.participants.length === 0) {
          embed.setDescription('参加者は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              document.participants.map(
                (participant) => `**${participant.email}**\nStatus: ${participant.status}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const title = interaction.options.getString('title', true).trim();
      const document = await createDocument(token, title);
      const embed = new EmbedBuilder()
        .setTitle('クラウドサイン 契約書を作成しました')
        .setColor(0x0066cc)
        .addFields(
          { name: 'ID', value: document.id || '-', inline: true },
          { name: 'Title', value: truncate(document.title, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'クラウドサイン連携の処理中にエラーが発生しました。');

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
