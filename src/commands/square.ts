import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createInvoice, listLocations, listTransactions } from '../integrations/square';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Square認証情報が未設定です')
    .setDescription('/vault set key:square_access_token value:<token> を設定してください')
    .setColor(0x3e4348);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const squareCommand = {
  data: new SlashCommandBuilder()
    .setName('square')
    .setDescription('Squareの店舗・決済・請求書を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('locations').setDescription('店舗一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('transactions')
        .setDescription('決済一覧を表示します')
        .addStringOption((option) =>
          option.setName('location_id').setDescription('Square location ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('invoice')
        .setDescription('請求書を作成します')
        .addStringOption((option) =>
          option.setName('location_id').setDescription('Square location ID').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('amount').setDescription('請求金額').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('description').setDescription('請求内容').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'square_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'locations') {
        const locations = await listLocations(token);
        const embed = new EmbedBuilder().setTitle('Square Locations').setColor(0x3e4348);

        if (locations.length === 0) {
          embed.setDescription('店舗は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              locations.map(
                (location) =>
                  `**${location.name}**\nID: ${location.id}\nAddress: ${location.address || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'transactions') {
        const locationId = interaction.options.getString('location_id', true).trim();
        const transactions = await listTransactions(token, locationId);
        const embed = new EmbedBuilder()
          .setTitle(`Square Transactions: ${locationId}`)
          .setColor(0x3e4348);

        if (transactions.length === 0) {
          embed.setDescription('決済は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              transactions.map(
                (transaction) =>
                  `**${transaction.id}**\nAmount: ${transaction.amount} ${transaction.currency}\nStatus: ${transaction.status}\nCreated: ${transaction.created_at}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const locationId = interaction.options.getString('location_id', true).trim();
      const amount = interaction.options.getInteger('amount', true);
      const description = interaction.options.getString('description', true).trim();
      const invoice = await createInvoice(token, locationId, amount, description);
      const embed = new EmbedBuilder()
        .setTitle('Square請求書を作成しました')
        .setColor(0x3e4348)
        .addFields(
          { name: 'Invoice ID', value: invoice.id || '-', inline: true },
          { name: 'Status', value: invoice.status, inline: true },
          { name: 'Location ID', value: locationId, inline: true },
          { name: 'Amount', value: `JPY ${amount}`, inline: true },
          { name: 'Description', value: truncate(description, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Square連携の処理中にエラーが発生しました。');

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
