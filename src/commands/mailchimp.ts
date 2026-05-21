import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getAudienceStats, getCampaigns, getLists } from '../integrations/mailchimp';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Mailchimp APIキーが未設定です')
    .setDescription('/vault set key:mailchimp_api_key value:... を実行してください')
    .setColor(0xffe01b);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const mailchimpCommand = {
  data: new SlashCommandBuilder()
    .setName('mailchimp')
    .setDescription('Mailchimpのオーディエンス・キャンペーンを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('lists').setDescription('オーディエンス一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('campaigns').setDescription('キャンペーン一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stats')
        .setDescription('オーディエンス統計を表示します')
        .addStringOption((option) =>
          option.setName('list_id').setDescription('Mailchimp list ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'mailchimp_api_key');

      if (!apiKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'lists') {
        const lists = await getLists(apiKey);
        const embed = new EmbedBuilder().setTitle('Mailchimp Lists').setColor(0xffe01b);

        if (lists.length === 0) {
          embed.setDescription('オーディエンスは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              lists.map(
                (list) =>
                  `**${list.name || '(No name)'}**\nID: ${list.id}\nMembers: ${list.stats.member_count}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'campaigns') {
        const campaigns = await getCampaigns(apiKey);
        const embed = new EmbedBuilder().setTitle('Mailchimp Campaigns').setColor(0xffe01b);

        if (campaigns.length === 0) {
          embed.setDescription('キャンペーンは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              campaigns.map(
                (campaign) =>
                  `**${campaign.settings.title || '(No title)'}**\nID: ${campaign.id}\nSubject: ${campaign.settings.subject_line || '-'}\nStatus: ${campaign.status || '-'}\nSend Time: ${campaign.send_time || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const listId = interaction.options.getString('list_id', true).trim();
      const stats = await getAudienceStats(apiKey, listId);
      const embed = new EmbedBuilder()
        .setTitle('Mailchimp Audience Stats')
        .setColor(0xffe01b)
        .addFields(
          { name: 'List ID', value: listId, inline: true },
          { name: 'Members', value: String(stats.member_count), inline: true },
          { name: 'Unsubscribes', value: String(stats.unsubscribe_count), inline: true },
          { name: 'Open Rate', value: String(stats.open_rate), inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Mailchimp連携の処理中にエラーが発生しました。');

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
