import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createPaymentLink,
  listCustomers,
  listPayments,
} from '../integrations/stripeapi';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Stripe認証情報が未設定です')
    .setDescription('/vault set key:stripe_secret_key value:sk_... を設定してください')
    .setColor(0x635bff);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatUnixSeconds(value: number): string {
  if (!value) {
    return '-';
  }

  return new Date(value * 1000).toISOString();
}

export const stripeapiCommand = {
  data: new SlashCommandBuilder()
    .setName('stripeapi')
    .setDescription('Stripe決済の顧客・支払い・決済リンクを管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('customers')
        .setDescription('顧客一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('payments')
        .setDescription('支払い一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('paylink')
        .setDescription('決済リンクを作成します')
        .addStringOption((option) =>
          option.setName('price_id').setDescription('Stripe Price ID').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('quantity').setDescription('数量').setRequired(false).setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const secretKey = vaultService.getCredential(
        interaction.user.id,
        'user',
        'stripe_secret_key'
      );

      if (!secretKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'customers') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const customers = await listCustomers(secretKey, limit);
        const embed = new EmbedBuilder().setTitle('Stripe Customers').setColor(0x635bff);

        if (typeof limit === 'number') {
          embed.addFields({ name: 'Limit', value: String(limit), inline: true });
        }

        if (customers.length === 0) {
          embed.setDescription('顧客は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              customers.map(
                (customer) =>
                  `**${customer.name || customer.id}**\nID: ${customer.id}\nEmail: ${customer.email || '-'}\nCreated: ${formatUnixSeconds(customer.created)}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'payments') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const payments = await listPayments(secretKey, limit);
        const embed = new EmbedBuilder().setTitle('Stripe Payments').setColor(0x635bff);

        if (typeof limit === 'number') {
          embed.addFields({ name: 'Limit', value: String(limit), inline: true });
        }

        if (payments.length === 0) {
          embed.setDescription('支払いは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              payments.map(
                (payment) =>
                  `**${payment.id}**\nAmount: ${payment.amount} ${payment.currency}\nStatus: ${payment.status}\nEmail: ${payment.customer_email || '-'}\nCreated: ${formatUnixSeconds(payment.created)}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const priceId = interaction.options.getString('price_id', true).trim();
      const quantity = interaction.options.getInteger('quantity') ?? undefined;
      const paymentLink = await createPaymentLink(secretKey, priceId, quantity);
      const embed = new EmbedBuilder()
        .setTitle('Stripe決済リンクを作成しました')
        .setColor(0x635bff)
        .addFields(
          { name: 'Payment Link ID', value: paymentLink.id || '-', inline: true },
          { name: 'Price ID', value: priceId, inline: true },
          { name: 'Quantity', value: String(quantity ?? 1), inline: true },
          { name: 'URL', value: truncate(paymentLink.url || '-', 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Stripe連携の処理中にエラーが発生しました。');

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
