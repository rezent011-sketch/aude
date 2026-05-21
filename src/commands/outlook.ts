import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getCalendarEvents, getEmails, sendEmail } from '../integrations/outlook';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_EMAIL_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Outlookアクセストークンが未設定です')
    .setDescription('/vault set key:outlook_access_token value:... を実行してください')
    .setColor(0x0078d4);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const outlookCommand = {
  data: new SlashCommandBuilder()
    .setName('outlook')
    .setDescription('Outlookのメール・カレンダーを操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('emails')
        .setDescription('最近のメール一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('top')
            .setDescription('取得件数。未指定時は10')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('メールを送信します')
        .addStringOption((option) =>
          option.setName('to').setDescription('送信先メールアドレス').setRequired(true).setMaxLength(MAX_EMAIL_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('subject').setDescription('件名').setRequired(true).setMaxLength(MAX_SUBJECT_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('body').setDescription('本文').setRequired(true).setMaxLength(MAX_BODY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('events').setDescription('予定一覧を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'outlook_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'emails') {
        const top = interaction.options.getInteger('top') ?? undefined;
        const emails = await getEmails(token, top);
        const embed = new EmbedBuilder().setTitle('Outlook Emails').setColor(0x0078d4);

        if (emails.length === 0) {
          embed.setDescription('メールは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              emails.map(
                (email) =>
                  `**${email.subject}**\nFrom: ${email.from || '-'}\nReceived: ${email.receivedDateTime || '-'}\nRead: ${email.isRead ? 'yes' : 'no'}`
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
        const body = interaction.options.getString('body', true).trim();
        await sendEmail(token, to, subject, body);

        const embed = new EmbedBuilder()
          .setTitle('Outlookメールを送信しました')
          .setColor(0x0078d4)
          .addFields(
            { name: 'To', value: to, inline: true },
            { name: 'Subject', value: truncate(subject, 1024), inline: false },
            { name: 'Body', value: truncate(body, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const events = await getCalendarEvents(token);
      const embed = new EmbedBuilder().setTitle('Outlook Events').setColor(0x0078d4);

      if (events.length === 0) {
        embed.setDescription('予定は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            events.map(
              (event) =>
                `**${event.subject}**\nStart: ${event.start || '-'}\nEnd: ${event.end || '-'}\nLocation: ${event.location || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Outlook連携の処理中にエラーが発生しました。');

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
