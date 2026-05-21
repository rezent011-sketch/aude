import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createTicket, getTicket, getTickets } from '../integrations/zendesk';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 4000;
const MAX_EMAIL_LENGTH = 320;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Zendesk認証情報が未設定です')
    .setDescription('/vault set で zendesk_email, zendesk_api_token, zendesk_subdomain を設定してください')
    .setColor(0x03363d);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const zendeskCommand = {
  data: new SlashCommandBuilder()
    .setName('zendesk')
    .setDescription('Zendeskのサポートチケットを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('tickets').setDescription('最近のチケット一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ticket')
        .setDescription('チケット詳細を表示します')
        .addIntegerOption((option) =>
          option.setName('id').setDescription('Zendesk ticket ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Zendeskチケットを作成します')
        .addStringOption((option) =>
          option
            .setName('subject')
            .setDescription('チケット件名')
            .setRequired(true)
            .setMaxLength(MAX_SUBJECT_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('body')
            .setDescription('チケット本文')
            .setRequired(true)
            .setMaxLength(MAX_BODY_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('email')
            .setDescription('依頼者メールアドレス')
            .setRequired(true)
            .setMaxLength(MAX_EMAIL_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const email = vaultService.getCredential(userId, 'user', 'zendesk_email');
      const token = vaultService.getCredential(userId, 'user', 'zendesk_api_token');
      const subdomain = vaultService.getCredential(userId, 'user', 'zendesk_subdomain');

      if (!email || !token || !subdomain) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'tickets') {
        const tickets = await getTickets(email, token, subdomain);
        const embed = new EmbedBuilder().setTitle('Zendesk Tickets').setColor(0x03363d);

        if (tickets.length === 0) {
          embed.setDescription('チケットは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              tickets.map(
                (ticket) =>
                  `**#${ticket.id} ${ticket.subject}**\n状態: ${ticket.status} / 優先度: ${ticket.priority || '未設定'}\n依頼者: ${ticket.requester_name || '不明'}\n作成: ${ticket.created_at}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'ticket') {
        const id = interaction.options.getInteger('id', true);
        const ticket = await getTicket(email, token, subdomain, id);
        const embed = new EmbedBuilder()
          .setTitle(`Zendesk Ticket #${ticket.id}`)
          .setColor(0x03363d)
          .addFields(
            { name: 'Subject', value: truncate(ticket.subject || '-', 1024), inline: false },
            { name: 'Status', value: ticket.status || '-', inline: true },
            { name: 'Description', value: truncate(ticket.description || '-', 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const subject = interaction.options.getString('subject', true).trim();
      const body = interaction.options.getString('body', true).trim();
      const requesterEmail = interaction.options.getString('email', true).trim();
      const ticket = await createTicket(email, token, subdomain, subject, body, requesterEmail);

      const embed = new EmbedBuilder()
        .setTitle('Zendeskチケットを作成しました')
        .setColor(0x03363d)
        .addFields(
          { name: 'ID', value: String(ticket.id), inline: true },
          { name: 'Subject', value: truncate(ticket.subject, 1024), inline: false },
          { name: 'Requester', value: requesterEmail, inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Zendesk連携の処理中にエラーが発生しました。');

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
