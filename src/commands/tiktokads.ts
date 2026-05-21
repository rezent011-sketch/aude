import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getAdvertisers, getCampaigns } from '../integrations/tiktokads';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('TikTok Adsアクセストークンが未設定です')
    .setDescription('/vault set key:tiktokads_access_token value:<token> を実行してください')
    .setColor(0x010101);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const tiktokadsCommand = {
  data: new SlashCommandBuilder()
    .setName('tiktokads')
    .setDescription('TikTok広告のアカウント・キャンペーンを確認します')
    .addSubcommand((subcommand) =>
      subcommand.setName('advertisers').setDescription('広告主一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('campaigns')
        .setDescription('キャンペーン一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('advertiser_id')
            .setDescription('TikTok Ads advertiser ID')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'tiktokads_access_token'
      );

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'advertisers') {
        const advertisers = await getAdvertisers(token);
        const embed = new EmbedBuilder().setTitle('TikTok Ads Advertisers').setColor(0x010101);

        if (advertisers.length === 0) {
          embed.setDescription('広告主は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              advertisers.map(
                (advertiser) =>
                  `**${advertiser.advertiser_name || '(No name)'}**\nID: ${advertiser.advertiser_id}\nStatus: ${advertiser.status || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const advertiserId = interaction.options.getString('advertiser_id', true).trim();
      const campaigns = await getCampaigns(token, advertiserId);
      const embed = new EmbedBuilder()
        .setTitle(`TikTok Ads Campaigns: ${advertiserId}`)
        .setColor(0x010101);

      if (campaigns.length === 0) {
        embed.setDescription('キャンペーンは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            campaigns.map(
              (campaign) =>
                `**${campaign.campaign_name || '(No name)'}**\nID: ${campaign.campaign_id}\nStatus: ${campaign.status || '-'}\nBudget: ${campaign.budget}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'TikTok Ads連携の処理中にエラーが発生しました。');

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
