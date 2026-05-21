import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getInventory, getOrders, getProducts } from '../integrations/shopify';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Shopify認証情報が未設定です')
    .setDescription(
      'shopify_access_token と shopify_shop_domain を /vault set で設定してください'
    )
    .setColor(0x95bf47);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const shopifyCommand = {
  data: new SlashCommandBuilder()
    .setName('shopify')
    .setDescription('ShopifyのEC店舗の注文・商品・在庫を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('orders')
        .setDescription('注文一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(50)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('products')
        .setDescription('商品一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('inventory')
        .setDescription('在庫を確認します')
        .addIntegerOption((option) =>
          option.setName('product_id').setDescription('Shopify product ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'shopify_access_token');
      const shop = vaultService.getCredential(interaction.user.id, 'user', 'shopify_shop_domain');

      if (!token || !shop) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'orders') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const orders = await getOrders(token, shop, limit);
        const embed = new EmbedBuilder().setTitle('Shopify Orders').setColor(0x95bf47);

        if (orders.length === 0) {
          embed.setDescription('注文は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              orders.map(
                (order) =>
                  `**#${order.order_number}**\nID: ${order.id}\nTotal: ${order.total_price}\nStatus: ${order.financial_status}\nCustomer: ${order.customer_name}\nCreated: ${order.created_at}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'products') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const products = await getProducts(token, shop, limit);
        const embed = new EmbedBuilder().setTitle('Shopify Products').setColor(0x95bf47);

        if (products.length === 0) {
          embed.setDescription('商品は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              products.map(
                (product) =>
                  `**${product.title}**\nID: ${product.id}\nStatus: ${product.status}\nVariants: ${product.variants_count}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const productId = interaction.options.getInteger('product_id', true);
      const inventory = await getInventory(token, shop, productId);
      const embed = new EmbedBuilder()
        .setTitle(`Shopify Inventory: ${productId}`)
        .setColor(0x95bf47);

      if (inventory.length === 0) {
        embed.setDescription('在庫情報は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            inventory.map(
              (item) =>
                `**${item.title}**\nVariant ID: ${item.variant_id}\nInventory: ${item.inventory_quantity}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Shopify連携の処理中にエラーが発生しました。');

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
