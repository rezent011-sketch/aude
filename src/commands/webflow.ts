import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getCollections, getSites, publishSite } from '../integrations/webflow';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Webflowアクセストークンが未設定です')
    .setDescription('/vault set key:webflow_access_token value:<token> を実行してください')
    .setColor(0x146ef5);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const webflowCommand = {
  data: new SlashCommandBuilder()
    .setName('webflow')
    .setDescription('WebflowのサイトをDiscordから管理・公開します')
    .addSubcommand((subcommand) =>
      subcommand.setName('sites').setDescription('サイト一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('collections')
        .setDescription('コレクション一覧を表示します')
        .addStringOption((option) =>
          option.setName('site_id').setDescription('Webflow site ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('publish')
        .setDescription('サイトを公開します')
        .addStringOption((option) =>
          option.setName('site_id').setDescription('Webflow site ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'webflow_access_token'
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

      if (subcommand === 'sites') {
        const sites = await getSites(token);
        const embed = new EmbedBuilder().setTitle('Webflow Sites').setColor(0x146ef5);

        if (sites.length === 0) {
          embed.setDescription('サイトは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              sites.map(
                (site) =>
                  `**${site.displayName}**\nID: ${site.id}\nShort Name: ${site.shortName || '-'}\nLast Published: ${site.lastPublished || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'collections') {
        const siteId = interaction.options.getString('site_id', true).trim();
        const collections = await getCollections(token, siteId);
        const embed = new EmbedBuilder()
          .setTitle(`Webflow Collections: ${siteId}`)
          .setColor(0x146ef5);

        if (collections.length === 0) {
          embed.setDescription('コレクションは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              collections.map(
                (collection) =>
                  `**${collection.displayName}**\nID: ${collection.id}\nSlug: ${collection.slug || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const siteId = interaction.options.getString('site_id', true).trim();
      const result = await publishSite(token, siteId);
      const embed = new EmbedBuilder()
        .setTitle('Webflowサイトの公開を開始しました')
        .setColor(0x146ef5)
        .addFields(
          { name: 'Site ID', value: siteId, inline: false },
          { name: 'Queued', value: result.queued ? 'yes' : 'no', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Webflow連携の処理中にエラーが発生しました。');

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
