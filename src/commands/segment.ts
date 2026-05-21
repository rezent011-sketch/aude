import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getDestinations, getSources } from '../integrations/segment';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Segmentアクセストークンが未設定です')
    .setDescription('/vault set key:segment_access_token value:<token> を設定してください')
    .setColor(0x52bd94);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const segmentCommand = {
  data: new SlashCommandBuilder()
    .setName('segment')
    .setDescription('SegmentのソースとDestinationを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('sources').setDescription('ソース一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('destinations').setDescription('Destination一覧を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'segment_access_token'
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

      if (subcommand === 'sources') {
        const sources = await getSources(token);
        const embed = new EmbedBuilder().setTitle('Segment Sources').setColor(0x52bd94);

        if (sources.length === 0) {
          embed.setDescription('ソースは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              sources.map(
                (source) =>
                  `**${source.name}**\nID: ${source.id}\nSlug: ${source.slug || '-'}\nEnabled: ${source.enabled ? 'yes' : 'no'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const destinations = await getDestinations(token);
      const embed = new EmbedBuilder().setTitle('Segment Destinations').setColor(0x52bd94);

      if (destinations.length === 0) {
        embed.setDescription('Destinationは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            destinations.map(
              (destination) =>
                `**${destination.name}**\nID: ${destination.id}\nSource ID: ${destination.sourceId || '-'}\nEnabled: ${destination.enabled ? 'yes' : 'no'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Segment連携の処理中にエラーが発生しました。');

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
