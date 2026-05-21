import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getDnsRecords, getZones, purgeCache } from '../integrations/cloudflare';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Cloudflare認証情報が未設定です')
    .setDescription('/vault set key:cloudflare_api_token value:... を実行してください')
    .setColor(0xf48120);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const cloudflareCommand = {
  data: new SlashCommandBuilder()
    .setName('cloudflare')
    .setDescription('CloudflareのDNS・キャッシュを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('zones').setDescription('zone一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('dns')
        .setDescription('DNS record一覧を表示します')
        .addStringOption((option) =>
          option.setName('zone_id').setDescription('Cloudflare zone ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('purge')
        .setDescription('zoneのキャッシュを全削除します')
        .addStringOption((option) =>
          option.setName('zone_id').setDescription('Cloudflare zone ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'cloudflare_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'zones') {
        const zones = await getZones(token);
        const embed = new EmbedBuilder().setTitle('Cloudflare Zones').setColor(0xf48120);

        if (zones.length === 0) {
          embed.setDescription('zoneは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              zones.map(
                (zone) =>
                  `**${zone.name}**\nID: ${zone.id}\nStatus: ${zone.status}\nPlan: ${zone.plan}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'dns') {
        const zoneId = interaction.options.getString('zone_id', true).trim();
        const records = await getDnsRecords(token, zoneId);
        const embed = new EmbedBuilder()
          .setTitle(`Cloudflare DNS: ${zoneId}`)
          .setColor(0xf48120);

        if (records.length === 0) {
          embed.setDescription('DNS recordは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              records.map(
                (record) =>
                  `**${record.type} ${record.name}**\nID: ${record.id}\nContent: ${record.content || '-'}\nTTL: ${record.ttl}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const zoneId = interaction.options.getString('zone_id', true).trim();
      const result = await purgeCache(token, zoneId);
      const embed = new EmbedBuilder()
        .setTitle('Cloudflare Cache Purged')
        .setColor(0xf48120)
        .addFields(
          { name: 'Zone ID', value: zoneId, inline: true },
          { name: 'Result ID', value: result.id || '-', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Cloudflare連携の処理中にエラーが発生しました。');

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
