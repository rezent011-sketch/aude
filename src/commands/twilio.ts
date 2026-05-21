import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getMessages, makeCall, sendSms } from '../integrations/twilio';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Twilio認証情報が未設定です')
    .setDescription(
      '/vault set key:twilio_account_sid value:<sid> と /vault set key:twilio_auth_token value:<token> と /vault set key:twilio_from_number value:+81... を設定してください'
    )
    .setColor(0xf22f46);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const twilioCommand = {
  data: new SlashCommandBuilder()
    .setName('twilio')
    .setDescription('TwilioでSMS送信・通話発信を行います')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sms')
        .setDescription('SMSを送信します')
        .addStringOption((option) =>
          option.setName('from').setDescription('送信元電話番号').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('to').setDescription('送信先電話番号').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('message').setDescription('送信するメッセージ').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('messages')
        .setDescription('SMS一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('call')
        .setDescription('通話を発信します')
        .addStringOption((option) =>
          option.setName('from').setDescription('発信元電話番号').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('to').setDescription('発信先電話番号').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('twiml_url').setDescription('TwiML URL').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const accountSid = vaultService.getCredential(
        interaction.user.id,
        'user',
        'twilio_account_sid'
      );
      const authToken = vaultService.getCredential(
        interaction.user.id,
        'user',
        'twilio_auth_token'
      );
      const defaultFromNumber = vaultService.getCredential(
        interaction.user.id,
        'user',
        'twilio_from_number'
      );

      if (!accountSid || !authToken || !defaultFromNumber) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'sms') {
        const from = interaction.options.getString('from', true).trim();
        const to = interaction.options.getString('to', true).trim();
        const message = interaction.options.getString('message', true).trim();
        const result = await sendSms(accountSid, authToken, from, to, message);

        const embed = new EmbedBuilder()
          .setTitle('TwilioでSMSを送信しました')
          .setColor(0xf22f46)
          .addFields(
            { name: 'SID', value: result.sid || '-', inline: true },
            { name: 'Status', value: result.status || '-', inline: true },
            { name: 'From', value: from, inline: true },
            { name: 'To', value: to, inline: true },
            { name: 'Default From', value: defaultFromNumber, inline: true },
            { name: 'Message', value: truncate(message, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'messages') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const messages = await getMessages(accountSid, authToken, limit);
        const embed = new EmbedBuilder().setTitle('Twilio Messages').setColor(0xf22f46);

        if (typeof limit === 'number') {
          embed.addFields({ name: 'Limit', value: String(limit), inline: true });
        }

        if (messages.length === 0) {
          embed.setDescription('メッセージは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              messages.map(
                (message) =>
                  `**${message.sid || '(No SID)'}**\nFrom: ${message.from || '-'}\nTo: ${message.to || '-'}\nStatus: ${message.status || '-'}\nSent: ${message.date_sent || '-'}\n${truncate(message.body, 240)}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const from = interaction.options.getString('from', true).trim();
      const to = interaction.options.getString('to', true).trim();
      const twimlUrl = interaction.options.getString('twiml_url', true).trim();
      const result = await makeCall(accountSid, authToken, from, to, twimlUrl);
      const embed = new EmbedBuilder()
        .setTitle('Twilioで通話を発信しました')
        .setColor(0xf22f46)
        .addFields(
          { name: 'SID', value: result.sid || '-', inline: true },
          { name: 'Status', value: result.status || '-', inline: true },
          { name: 'From', value: from, inline: true },
          { name: 'To', value: to, inline: true },
          { name: 'Default From', value: defaultFromNumber, inline: true },
          { name: 'TwiML URL', value: truncate(twimlUrl, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Twilio連携の処理中にエラーが発生しました。');

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
