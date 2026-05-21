import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getBalance, sendSms } from '../integrations/vonage';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Vonage認証情報が未設定です')
    .setDescription(
      '/vault set key:vonage_api_key value:<api_key> と /vault set key:vonage_api_secret value:<api_secret> を設定してください'
    )
    .setColor(0x4b0082);
}

export const vonageCommand = {
  data: new SlashCommandBuilder()
    .setName('vonage')
    .setDescription('VonageでSMS送信・残高確認を行います')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sms')
        .setDescription('SMSを送信します')
        .addStringOption((option) =>
          option.setName('from').setDescription('送信元名または番号').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('to').setDescription('送信先電話番号').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('message').setDescription('送信メッセージ').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('balance').setDescription('残高を確認します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'vonage_api_key');
      const apiSecret = vaultService.getCredential(
        interaction.user.id,
        'user',
        'vonage_api_secret'
      );

      if (!apiKey || !apiSecret) {
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
        const result = await sendSms(apiKey, apiSecret, from, to, message);

        const embed = new EmbedBuilder()
          .setTitle('VonageでSMSを送信しました')
          .setColor(0x4b0082)
          .addFields(
            { name: 'Message ID', value: result.messageId || '-', inline: true },
            { name: 'Status', value: result.status || '-', inline: true },
            { name: 'From', value: from, inline: true },
            { name: 'To', value: to, inline: true },
            { name: 'Message', value: truncate(message, 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const balance = await getBalance(apiKey, apiSecret);
      const embed = new EmbedBuilder()
        .setTitle('Vonage Balance')
        .setColor(0x4b0082)
        .addFields(
          { name: 'Value', value: String(balance.value), inline: true },
          { name: 'Auto Reload', value: balance.autoReload ? 'yes' : 'no', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Vonage連携の処理中にエラーが発生しました。');

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
