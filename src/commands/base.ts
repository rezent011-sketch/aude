import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getItems, getOrders, getShopInfo } from '../integrations/base';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('BASEアクセストークンが未設定です')
    .setDescription('/vault set key:base_access_token value:<token> を実行してください')
    .setColor(0x000000);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const baseCommand = {
  data: new SlashCommandBuilder()
    .setName('base')
    .setDescription('BASEのショップ・商品・注文を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('shop').setDescription('ショップ情報を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('items')
        .setDescription('商品一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数')
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
            .setName('limit')
            .setDescription('取得件数')
            .setRequired(false)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'base_access_token');

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
        const shop = await getShopInfo(token);
        const embed = new EmbedBuilder()
          .setTitle('BASE Shop')
          .setColor(0x000000)
          .addFields(
            { name: 'Shop Name', value: shop.shop_name || '-', inline: true },
            { name: 'Shop URL', value: shop.shop_url || '-', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'items') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const items = await getItems(token, limit);
        const embed = new EmbedBuilder().setTitle('BASE Items').setColor(0x000000);

        if (typeof limit === 'number') {
          embed.addFields({ name: 'Limit', value: String(limit), inline: true });
        }

        if (items.length === 0) {
          embed.setDescription('商品は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              items.map(
                (item) =>
                  `**${item.title}**\nID: ${item.item_id}\nPrice: ${item.price}\nStock: ${item.stock}\nVisible: ${item.visible}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const limit = interaction.options.getInteger('limit') ?? undefined;
      const orders = await getOrders(token, limit);
      const embed = new EmbedBuilder().setTitle('BASE Orders').setColor(0x000000);

      if (typeof limit === 'number') {
        embed.addFields({ name: 'Limit', value: String(limit), inline: true });
      }

      if (orders.length === 0) {
        embed.setDescription('注文は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            orders.map(
              (order) =>
                `**${order.name}**\nOrder Key: ${order.unique_key}\nTotal: ${order.total}\nStatus: ${order.order_status}\nOrdered At: ${order.ordered_at}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'BASE連携の処理中にエラーが発生しました。');

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
