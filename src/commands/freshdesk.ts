import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { addNote, createTicket, getTickets } from '../integrations/freshdesk';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_SUBJECT_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_EMAIL_LENGTH = 320;
const MAX_NOTE_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Freshdesk認証情報が未設定です')
    .setDescription('/vault set で freshdesk_api_key, freshdesk_domain を設定してください')
    .setColor(0x25c16f);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const freshdeskCommand = {
  data: new SlashCommandBuilder()
    .setName('freshdesk')
    .setDescription('Freshdeskのサポートチケットを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('tickets').setDescription('最近のチケット一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Freshdeskチケットを作成します')
        .addStringOption((option) =>
          option
            .setName('subject')
            .setDescription('チケット件名')
            .setRequired(true)
            .setMaxLength(MAX_SUBJECT_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('チケット本文')
            .setRequired(true)
            .setMaxLength(MAX_DESCRIPTION_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('email')
            .setDescription('依頼者メールアドレス')
            .setRequired(true)
            .setMaxLength(MAX_EMAIL_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('priority')
            .setDescription('priority番号')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('note')
        .setDescription('チケットにノートを追加します')
        .addIntegerOption((option) =>
          option.setName('ticket_id').setDescription('Freshdesk ticket ID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('body')
            .setDescription('ノート本文')
            .setRequired(true)
            .setMaxLength(MAX_NOTE_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const apiKey = vaultService.getCredential(userId, 'user', 'freshdesk_api_key');
      const domain = vaultService.getCredential(userId, 'user', 'freshdesk_domain');

      if (!apiKey || !domain) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'tickets') {
        const tickets = await getTickets(apiKey, domain);
        const embed = new EmbedBuilder().setTitle('Freshdesk Tickets').setColor(0x25c16f);

        if (tickets.length === 0) {
          embed.setDescription('チケットは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              tickets.map(
                (ticket) =>
                  `**#${ticket.id} ${ticket.subject}**\n状態: ${ticket.status} / 優先度: ${ticket.priority}\n作成: ${ticket.created_at}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create') {
        const subject = interaction.options.getString('subject', true).trim();
        const description = interaction.options.getString('description', true).trim();
        const email = interaction.options.getString('email', true).trim();
        const priority = interaction.options.getInteger('priority') ?? undefined;
        const ticket = await createTicket(apiKey, domain, subject, description, email, priority);

        const embed = new EmbedBuilder()
          .setTitle('Freshdeskチケットを作成しました')
          .setColor(0x25c16f)
          .addFields(
            { name: 'ID', value: String(ticket.id), inline: true },
            { name: 'Subject', value: truncate(ticket.subject, 1024), inline: false },
            { name: 'Requester', value: email, inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const ticketId = interaction.options.getInteger('ticket_id', true);
      const body = interaction.options.getString('body', true).trim();
      await addNote(apiKey, domain, ticketId, body);

      const embed = new EmbedBuilder()
        .setTitle('Freshdeskにノートを追加しました')
        .setColor(0x25c16f)
        .addFields(
          { name: 'Ticket ID', value: String(ticketId), inline: true },
          { name: 'Body', value: truncate(body, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Freshdesk連携の処理中にエラーが発生しました。');

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
