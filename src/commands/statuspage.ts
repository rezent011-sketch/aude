import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createIncident, getIncidents, getPages } from '../integrations/statuspage';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_INCIDENT_BODY_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Statuspage認証情報が未設定です')
    .setDescription('/vault set key:statuspage_api_key value:... を実行してください')
    .setColor(0x39a845);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const statuspageCommand = {
  data: new SlashCommandBuilder()
    .setName('statuspage')
    .setDescription('Statuspageのインシデント・ステータスを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('pages').setDescription('page一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('incidents')
        .setDescription('incident一覧を表示します')
        .addStringOption((option) =>
          option.setName('page_id').setDescription('Statuspage page ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('incidentを作成します')
        .addStringOption((option) =>
          option.setName('page_id').setDescription('Statuspage page ID').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('name').setDescription('Incident name').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('status').setDescription('Incident status').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('impact').setDescription('Impact override').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('body')
            .setDescription('Incident body')
            .setRequired(true)
            .setMaxLength(MAX_INCIDENT_BODY_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'statuspage_api_key');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'pages') {
        const pages = await getPages(token);
        const embed = new EmbedBuilder().setTitle('Statuspage Pages').setColor(0x39a845);

        if (pages.length === 0) {
          embed.setDescription('pageは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              pages.map(
                (page) =>
                  `**${page.name}**\nID: ${page.id}\nSubdomain: ${page.subdomain}\nDescription: ${page.page_description}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'incidents') {
        const pageId = interaction.options.getString('page_id', true).trim();
        const incidents = await getIncidents(token, pageId);
        const embed = new EmbedBuilder()
          .setTitle(`Statuspage Incidents: ${pageId}`)
          .setColor(0x39a845);

        if (incidents.length === 0) {
          embed.setDescription('incidentは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              incidents.map(
                (incident) =>
                  `**${incident.name}**\nID: ${incident.id}\nStatus: ${incident.status}\nImpact: ${incident.impact}\nCreated: ${incident.created_at || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const pageId = interaction.options.getString('page_id', true).trim();
      const name = interaction.options.getString('name', true).trim();
      const status = interaction.options.getString('status', true).trim();
      const impact = interaction.options.getString('impact', true).trim();
      const body = interaction.options.getString('body', true).trim();
      const incident = await createIncident(token, pageId, name, status, impact, body);

      const embed = new EmbedBuilder()
        .setTitle('Statuspage Incident Created')
        .setColor(0x39a845)
        .addFields(
          { name: 'Page ID', value: pageId, inline: true },
          { name: 'Incident ID', value: incident.id || '-', inline: true },
          { name: 'Status', value: status, inline: true },
          { name: 'Impact', value: impact, inline: true }
        )
        .setDescription(`**${incident.name}**\n${truncate(body, 3500)}`);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Statuspage連携の処理中にエラーが発生しました。');

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
