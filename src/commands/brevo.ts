import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getContacts,
  getEmailStats,
  sendTransactionalEmail,
} from '../integrations/brevo';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Brevo認証情報が未設定です')
    .setDescription(
      '/vault set key:brevo_api_key value:<token> と /vault set key:brevo_sender_email value:sender@example.com を設定してください'
    )
    .setColor(0x0b996e);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const brevoCommand = {
  data: new SlashCommandBuilder()
    .setName('brevo')
    .setDescription('Brevoのコンタクト・メール配信を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('contacts')
        .setDescription('コンタクト一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数。未指定時は20')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('トランザクションメールを送信します')
        .addStringOption((option) =>
          option.setName('to').setDescription('送信先メールアドレス').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('subject').setDescription('件名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('content').setDescription('HTML本文').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('sender').setDescription('送信者名。未指定時はAude').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stats').setDescription('メール配信統計を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'brevo_api_key');
      const senderEmail = vaultService.getCredential(
        interaction.user.id,
        'user',
        'brevo_sender_email'
      );

      if (!apiKey || !senderEmail) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'contacts') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const contacts = await getContacts(apiKey, limit);
        const embed = new EmbedBuilder().setTitle('Brevo Contacts').setColor(0x0b996e);

        if (contacts.length === 0) {
          embed.setDescription('コンタクトは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              contacts.map(
                (contact) =>
                  `**${`${contact.firstName} ${contact.lastName}`.trim() || '(No name)'}**\nID: ${contact.id}\nEmail: ${contact.email || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'send') {
        const to = interaction.options.getString('to', true).trim();
        const subject = interaction.options.getString('subject', true).trim();
        const content = interaction.options.getString('content', true).trim();
        const senderName = interaction.options.getString('sender')?.trim();
        const result = await sendTransactionalEmail(
          apiKey,
          to,
          subject,
          content,
          senderEmail,
          senderName
        );

        const embed = new EmbedBuilder()
          .setTitle('Brevoでメールを送信しました')
          .setColor(0x0b996e)
          .addFields(
            { name: 'To', value: to, inline: true },
            { name: 'Sender Email', value: senderEmail, inline: true },
            { name: 'Sender Name', value: senderName || 'Aude', inline: true },
            { name: 'Subject', value: truncate(subject, 1024), inline: false },
            { name: 'Message ID', value: result.messageId || '-', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const stats = await getEmailStats(apiKey);
      const embed = new EmbedBuilder()
        .setTitle('Brevo Email Stats')
        .setColor(0x0b996e)
        .addFields(
          { name: 'Requests', value: String(stats.requests), inline: true },
          { name: 'Delivered', value: String(stats.delivered), inline: true },
          { name: 'Hard Bounces', value: String(stats.hardBounces), inline: true },
          { name: 'Soft Bounces', value: String(stats.softBounces), inline: true },
          { name: 'Opens', value: String(stats.opens), inline: true },
          { name: 'Clicks', value: String(stats.clicks), inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Brevo連携の処理中にエラーが発生しました。');

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
