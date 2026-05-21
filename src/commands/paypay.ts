import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { createPayment, getPaymentStatus } from '../integrations/paypay';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('PayPay認証情報が未設定です')
    .setDescription(
      '/vault set key:paypay_api_key value:<key> と /vault set key:paypay_api_secret value:<secret> を設定してください'
    )
    .setColor(0xff0033);
}

function generatePaymentId(userId: string): string {
  return `paypay-${userId}-${Date.now()}`;
}

export const paypayCommand = {
  data: new SlashCommandBuilder()
    .setName('paypay')
    .setDescription('PayPay for Businessで決済QRの作成・状態確認を行います')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('決済QRコードを作成します')
        .addIntegerOption((option) =>
          option.setName('amount').setDescription('決済金額').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('description').setDescription('決済説明').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('payment_id')
            .setDescription('決済ID省略時は自動生成')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('決済状態を確認します')
        .addStringOption((option) =>
          option.setName('payment_id').setDescription('merchantPaymentId').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'paypay_api_key');
      const apiSecret = vaultService.getCredential(
        interaction.user.id,
        'user',
        'paypay_api_secret'
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

      if (subcommand === 'create') {
        const amount = interaction.options.getInteger('amount', true);
        const description = interaction.options.getString('description', true).trim();
        const paymentId =
          interaction.options.getString('payment_id')?.trim() || generatePaymentId(interaction.user.id);
        const payment = await createPayment(apiKey, apiSecret, paymentId, amount, description);

        const embed = new EmbedBuilder()
          .setTitle('PayPay決済QRコードを作成しました')
          .setColor(0xff0033)
          .addFields(
            { name: 'Payment ID', value: payment.merchantPaymentId, inline: true },
            { name: 'Amount', value: `JPY ${amount}`, inline: true },
            { name: 'Description', value: truncate(description, 1024), inline: false },
            { name: 'Payment URL', value: payment.paymentUrl || '-', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const paymentId = interaction.options.getString('payment_id', true).trim();
      const status = await getPaymentStatus(apiKey, apiSecret, paymentId);
      const embed = new EmbedBuilder()
        .setTitle('PayPay決済状態')
        .setColor(0xff0033)
        .addFields(
          { name: 'Payment ID', value: paymentId, inline: true },
          { name: 'Status', value: status.status, inline: true },
          { name: 'Amount', value: `JPY ${status.amount}`, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'PayPay連携の処理中にエラーが発生しました。');

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
