import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getEnvelope, getEnvelopes } from '../integrations/docusign';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_ENVELOPE_ID_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('DocuSign認証情報が未設定です')
    .setDescription(
      '/vault set key:docusign_access_token value:<token> と /vault set key:docusign_account_id value:<account_id> を実行してください'
    )
    .setColor(0xffcc00);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const docusignCommand = {
  data: new SlashCommandBuilder()
    .setName('docusign')
    .setDescription('DocuSignの電子署名封筒を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('envelopes').setDescription('封筒一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('envelope')
        .setDescription('封筒詳細を表示します')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('DocuSign envelope ID')
            .setRequired(true)
            .setMaxLength(MAX_ENVELOPE_ID_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'docusign_access_token');
      const accountId = vaultService.getCredential(
        interaction.user.id,
        'user',
        'docusign_account_id'
      );

      if (!token || !accountId) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'envelopes') {
        const envelopes = await getEnvelopes(token, accountId);
        const embed = new EmbedBuilder().setTitle('DocuSign Envelopes').setColor(0xffcc00);

        if (envelopes.length === 0) {
          embed.setDescription('封筒は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              envelopes.slice(0, 10).map(
                (envelope) =>
                  `**${envelope.subject}**\nID: ${envelope.envelopeId}\nStatus: ${envelope.status}\nSent: ${envelope.sentDateTime || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const envelopeId = interaction.options.getString('id', true).trim();
      const envelope = await getEnvelope(token, accountId, envelopeId);
      const embed = new EmbedBuilder()
        .setTitle(`DocuSign Envelope: ${envelope.subject}`)
        .setColor(0xffcc00)
        .addFields(
          { name: 'ID', value: envelope.envelopeId || envelopeId, inline: true },
          { name: 'Status', value: envelope.status || '-', inline: true }
        );

      if (envelope.recipients.length === 0) {
        embed.setDescription('受信者は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            envelope.recipients.map(
              (recipient) =>
                `**${recipient.name}**\nEmail: ${recipient.email}\nStatus: ${recipient.status}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'DocuSign連携の処理中にエラーが発生しました。');

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
