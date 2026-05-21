import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getOrders, getProducts, getShop } from '../integrations/stores';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('STORESアクセストークンが未設定です')
    .setDescription('/vault set key:stores_access_token value:<token> を実行してください')
    .setColor(0xff4b4b);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const storesCommand = {
  data: new SlashCommandBuilder()
    .setName('stores')
    .setDescription('STORESのショップ・商品・注文を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('shop').setDescription('ショップ情報を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('products')
        .setDescription('商品一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('page')
            .setDescription('ページ番号')
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('orders')
        .setDescription('注文一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('page')
            .setDescription('ページ番号')
            .setRequired(false)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'stores_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'shop') {
        const shop = await getShop(token);
        const embed = new EmbedBuilder()
          .setTitle('STORES Shop')
          .setColor(0xff4b4b)
          .addFields(
            { name: 'ID', value: shop.id || '-', inline: true },
            { name: 'Name', value: shop.name || '-', inline: true },
            { name: 'URL', value: shop.url || '-', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'products') {
        const page = interaction.options.getInteger('page') ?? undefined;
        const products = await getProducts(token, page);
        const embed = new EmbedBuilder().setTitle('STORES Products').setColor(0xff4b4b);

        if (typeof page === 'number') {
          embed.addFields({ name: 'Page', value: String(page), inline: true });
        }

        if (products.length === 0) {
          embed.setDescription('商品は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              products.map(
                (product) =>
                  `**${product.name}**\nID: ${product.id}\nPrice: ${product.price}\nStock: ${product.stock}\nStatus: ${product.status}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const page = interaction.options.getInteger('page') ?? undefined;
      const orders = await getOrders(token, page);
      const embed = new EmbedBuilder().setTitle('STORES Orders').setColor(0xff4b4b);

      if (typeof page === 'number') {
        embed.addFields({ name: 'Page', value: String(page), inline: true });
      }

      if (orders.length === 0) {
        embed.setDescription('注文は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            orders.map(
              (order) =>
                `**${order.buyer_name}**\nID: ${order.id}\nTotal: ${order.total}\nStatus: ${order.status}\nCreated: ${order.created_at}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'STORES連携の処理中にエラーが発生しました。');

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
