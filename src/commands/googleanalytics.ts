import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getActiveUsers, getPageViews } from '../integrations/googleanalytics';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Google Analyticsアクセストークンが未設定です')
    .setDescription('/vault set key:googleanalytics_access_token value:<token> を実行してください')
    .setColor(0xe37400);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const googleanalyticsCommand = {
  data: new SlashCommandBuilder()
    .setName('googleanalytics')
    .setDescription('Google Analytics 4のアクセス解析データを確認します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('users')
        .setDescription('アクティブユーザー数を確認します')
        .addStringOption((option) =>
          option.setName('property_id').setDescription('GA4 property ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pages')
        .setDescription('ページビュー上位ページを確認します')
        .addStringOption((option) =>
          option.setName('property_id').setDescription('GA4 property ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'googleanalytics_access_token'
      );

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const propertyId = interaction.options.getString('property_id', true).trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'users') {
        const users = await getActiveUsers(token, propertyId);
        const embed = new EmbedBuilder()
          .setTitle(`Google Analytics Users: ${propertyId}`)
          .setColor(0xe37400)
          .addFields(
            { name: 'Today', value: users.today, inline: true },
            { name: 'Last 7 Days', value: users.last7days, inline: true },
            { name: 'Last 30 Days', value: users.last30days, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const pages = await getPageViews(token, propertyId);
      const embed = new EmbedBuilder()
        .setTitle(`Google Analytics Pages: ${propertyId}`)
        .setColor(0xe37400);

      if (pages.length === 0) {
        embed.setDescription('ページビューは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            pages.map(
              (page) =>
                `**${page.pagePath || '(not set)'}**\nScreen Page Views: ${page.screenPageViews}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'Google Analytics連携の処理中にエラーが発生しました。'
      );

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
