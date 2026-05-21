import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getLists, getStats, sendEmail } from '../integrations/sendgrid';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('SendGrid認証情報が未設定です')
    .setDescription(
      '/vault set key:sendgrid_api_key value:SG... と /vault set key:sendgrid_from_email value:sender@example.com を設定してください'
    )
    .setColor(0x1a82e2);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatDateOffset(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

export const sendgridCommand = {
  data: new SlashCommandBuilder()
    .setName('sendgrid')
    .setDescription('SendGridでメール送信・配信統計を確認します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('メールを送信します')
        .addStringOption((option) =>
          option.setName('to').setDescription('送信先メールアドレス').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('from_email').setDescription('送信元メールアドレス').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('subject').setDescription('件名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('message').setDescription('本文').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stats')
        .setDescription('配信統計を表示します')
        .addStringOption((option) =>
          option
            .setName('start_date')
            .setDescription('開始日 YYYY-MM-DD。省略時は7日前')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('lists').setDescription('コンタクトリスト一覧を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'sendgrid_api_key');
      const configuredFromEmail = vaultService.getCredential(
        interaction.user.id,
        'user',
        'sendgrid_from_email'
      );

      if (!apiKey || !configuredFromEmail) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'send') {
        const to = interaction.options.getString('to', true).trim();
        const fromEmail = interaction.options.getString('from_email', true).trim();
        const subject = interaction.options.getString('subject', true).trim();
        const message = interaction.options.getString('message', true).trim();
        await sendEmail(apiKey, to, fromEmail, subject, message);

        const embed = new EmbedBuilder()
          .setTitle('SendGridでメールを送信しました')
          .setColor(0x1a82e2)
          .addFields(
            { name: 'To', value: to, inline: true },
            { name: 'From', value: fromEmail, inline: true },
            { name: 'Configured From', value: configuredFromEmail, inline: true },
            { name: 'Subject', value: truncate(subject, 1024), inline: false },
            { name: 'Message', value: truncate(message, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'stats') {
        const startDate = interaction.options.getString('start_date')?.trim() || formatDateOffset(7);
        const stats = await getStats(apiKey, startDate);
        const embed = new EmbedBuilder().setTitle('SendGrid Stats').setColor(0x1a82e2);

        embed.addFields({ name: 'Start Date', value: startDate, inline: true });

        if (stats.length === 0) {
          embed.setDescription('統計は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              stats.map(
                (entry) =>
                  `**${entry.date || '(No date)'}**\nDelivered: ${entry.delivered}\nOpens: ${entry.opens}\nClicks: ${entry.clicks}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const lists = await getLists(apiKey);
      const embed = new EmbedBuilder().setTitle('SendGrid Lists').setColor(0x1a82e2);

      if (lists.length === 0) {
        embed.setDescription('リストは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            lists.map(
              (entry) =>
                `**${entry.name}**\nID: ${entry.id}\nContacts: ${entry.contact_count}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'SendGrid連携の処理中にエラーが発生しました。');

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
