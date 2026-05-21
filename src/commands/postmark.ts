import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getStats, listTemplates, sendEmail } from '../integrations/postmark';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Postmark Server Tokenが未設定です')
    .setDescription('/vault set key:postmark_server_token value:<token> を設定してください')
    .setColor(0xffdd00);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const postmarkCommand = {
  data: new SlashCommandBuilder()
    .setName('postmark')
    .setDescription('Postmarkのトランザクションメール送信・統計を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('トランザクションメールを送信します')
        .addStringOption((option) =>
          option.setName('from').setDescription('送信元メールアドレス').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('to').setDescription('送信先メールアドレス').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('subject').setDescription('件名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('body').setDescription('テキスト本文').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stats').setDescription('送信統計を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('templates').setDescription('テンプレート一覧を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'postmark_server_token'
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

      if (subcommand === 'send') {
        const from = interaction.options.getString('from', true).trim();
        const to = interaction.options.getString('to', true).trim();
        const subject = interaction.options.getString('subject', true).trim();
        const body = interaction.options.getString('body', true).trim();
        const result = await sendEmail(token, from, to, subject, body);

        const embed = new EmbedBuilder()
          .setTitle('Postmarkでメールを送信しました')
          .setColor(0xffdd00)
          .addFields(
            { name: 'Message ID', value: result.MessageID || '-', inline: true },
            { name: 'Submitted At', value: result.SubmittedAt || '-', inline: true },
            { name: 'From', value: from, inline: true },
            { name: 'To', value: to, inline: true },
            { name: 'Subject', value: truncate(subject, 1024), inline: false },
            { name: 'Body', value: truncate(body, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'stats') {
        const stats = await getStats(token);
        const embed = new EmbedBuilder()
          .setTitle('Postmark Stats')
          .setColor(0xffdd00)
          .addFields(
            { name: 'Sent', value: String(stats.Sent), inline: true },
            { name: 'Bounced', value: String(stats.Bounced), inline: true },
            { name: 'Opens', value: String(stats.Opens), inline: true },
            { name: 'Clicks', value: String(stats.Clicks), inline: true },
            { name: 'Spam Complaints', value: String(stats.SpamComplaints), inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const templates = await listTemplates(token);
      const embed = new EmbedBuilder().setTitle('Postmark Templates').setColor(0xffdd00);

      if (templates.length === 0) {
        embed.setDescription('テンプレートは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            templates.map(
              (template) =>
                `**${template.Name}**\nTemplate ID: ${template.TemplateId}\nActive: ${template.Active ? 'yes' : 'no'}\nType: ${template.TemplateType || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Postmark連携の処理中にエラーが発生しました。');

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
