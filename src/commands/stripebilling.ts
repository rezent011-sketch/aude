import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { listInvoices, listSubscriptions } from '../integrations/stripebilling';
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

export const stripebillingCommand = {
  data: new SlashCommandBuilder()
    .setName('stripebilling')
    .setDescription('Stripeのサブスクリプション・請求書を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('subscriptions')
        .setDescription('サブスクリプション一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('invoices')
        .setDescription('請求書一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
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

      if (subcommand === 'subscriptions') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const subscriptions = await listSubscriptions(secretKey, limit);
        const embed = new EmbedBuilder()
          .setTitle('Stripe Subscriptions')
          .setColor(0x635bff);

        if (typeof limit === 'number') {
          embed.addFields({ name: 'Limit', value: String(limit), inline: true });
        }

        if (subscriptions.length === 0) {
          embed.setDescription('サブスクリプションは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              subscriptions.map(
                (subscription) =>
                  `**${subscription.id}**\nStatus: ${subscription.status}\nCustomer: ${subscription.customer || '-'}\nCurrent Period End: ${formatUnixSeconds(subscription.current_period_end)}\nPlan: ${subscription.plan_amount} ${subscription.plan_currency}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const limit = interaction.options.getInteger('limit') ?? undefined;
      const invoices = await listInvoices(secretKey, limit);
      const embed = new EmbedBuilder().setTitle('Stripe Invoices').setColor(0x635bff);

      if (typeof limit === 'number') {
        embed.addFields({ name: 'Limit', value: String(limit), inline: true });
      }

      if (invoices.length === 0) {
        embed.setDescription('請求書は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            invoices.map(
              (invoice) =>
                `**${invoice.id}**\nCustomer Email: ${invoice.customer_email || '-'}\nAmount Due: ${invoice.amount_due}\nStatus: ${invoice.status}\nCreated: ${formatUnixSeconds(invoice.created)}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Stripe Billing連携の処理中にエラーが発生しました。');

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
