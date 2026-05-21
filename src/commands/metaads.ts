import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getAdAccounts,
  getCampaignInsights,
  getCampaigns,
} from '../integrations/metaads';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Meta Adsアクセストークンが未設定です')
    .setDescription('/vault set key:metaads_access_token value:<token> を実行してください')
    .setColor(0x1877f2);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const metaadsCommand = {
  data: new SlashCommandBuilder()
    .setName('metaads')
    .setDescription('Meta（Facebook/Instagram）広告のキャンペーンを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('accounts').setDescription('広告アカウント一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('campaigns')
        .setDescription('キャンペーン一覧を表示します')
        .addStringOption((option) =>
          option.setName('account_id').setDescription('Meta Ads account ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('insights')
        .setDescription('キャンペーンの配信指標を表示します')
        .addStringOption((option) =>
          option
            .setName('campaign_id')
            .setDescription('Meta Ads campaign ID')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'metaads_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'accounts') {
        const accounts = await getAdAccounts(token);
        const embed = new EmbedBuilder().setTitle('Meta Ads Accounts').setColor(0x1877f2);

        if (accounts.length === 0) {
          embed.setDescription('広告アカウントは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              accounts.map(
                (account) =>
                  `**${account.name || '(No name)'}**\nID: ${account.id}\nCurrency: ${account.currency || '-'}\nStatus: ${account.account_status}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'campaigns') {
        const accountId = interaction.options.getString('account_id', true).trim();
        const campaigns = await getCampaigns(token, accountId);
        const embed = new EmbedBuilder()
          .setTitle(`Meta Ads Campaigns: ${accountId}`)
          .setColor(0x1877f2);

        if (campaigns.length === 0) {
          embed.setDescription('キャンペーンは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              campaigns.map(
                (campaign) =>
                  `**${campaign.name || '(No name)'}**\nID: ${campaign.id}\nStatus: ${campaign.status || '-'}\nObjective: ${campaign.objective || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const campaignId = interaction.options.getString('campaign_id', true).trim();
      const insights = await getCampaignInsights(token, campaignId);
      const embed = new EmbedBuilder()
        .setTitle(`Meta Ads Insights: ${campaignId}`)
        .setColor(0x1877f2)
        .addFields(
          { name: 'Impressions', value: insights.impressions, inline: true },
          { name: 'Clicks', value: insights.clicks, inline: true },
          { name: 'CTR', value: insights.ctr, inline: true },
          { name: 'Spend', value: insights.spend, inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Meta Ads連携の処理中にエラーが発生しました。');

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
