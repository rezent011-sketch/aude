import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  acknowledgeIncident,
  listIncidents,
  listServices,
  resolveIncident,
  triggerAlert,
} from '../integrations/pagerduty';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_INCIDENT_ID_LENGTH = 100;
const MAX_SUMMARY_LENGTH = 1024;

type PagerDutySeverity = 'critical' | 'error' | 'warning' | 'info';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('PagerDuty認証情報が未設定です')
    .setDescription('/vault set で pagerduty_api_key, pagerduty_email を設定してください')
    .setColor(0xff9900);
}

function getSeverityColor(severity: PagerDutySeverity): number {
  switch (severity) {
    case 'critical':
      return 0xed4245;
    case 'error':
      return 0xe67e22;
    case 'warning':
      return 0xfee75c;
    case 'info':
      return 0x3498db;
  }
}

export const pagerdutyCommand = {
  data: new SlashCommandBuilder()
    .setName('pagerduty')
    .setDescription('PagerDutyのincidentとserviceを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('incidents').setDescription('Open incidentを一覧表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('acknowledge')
        .setDescription('incidentをacknowledgeします')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('PagerDuty incident ID')
            .setRequired(true)
            .setMaxLength(MAX_INCIDENT_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('resolve')
        .setDescription('incidentをresolveします')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('PagerDuty incident ID')
            .setRequired(true)
            .setMaxLength(MAX_INCIDENT_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('services').setDescription('service一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('trigger')
        .setDescription('PagerDuty alertをtriggerします')
        .addStringOption((option) =>
          option
            .setName('summary')
            .setDescription('Alert summary')
            .setRequired(true)
            .setMaxLength(MAX_SUMMARY_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('severity')
            .setDescription('Alert severity')
            .setRequired(false)
            .addChoices(
              { name: 'critical', value: 'critical' },
              { name: 'error', value: 'error' },
              { name: 'warning', value: 'warning' },
              { name: 'info', value: 'info' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const apiKey = vaultService.getCredential(userId, 'user', 'pagerduty_api_key');
      const email = vaultService.getCredential(userId, 'user', 'pagerduty_email');

      if (!apiKey || !email) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'incidents') {
        const incidents = await listIncidents(apiKey);
        const embed = new EmbedBuilder()
          .setTitle('PagerDuty Incidents')
          .setColor(0xed4245)
          .setTimestamp();

        if (incidents.length === 0) {
          embed.setDescription('Open incidentは見つかりませんでした。');
        } else {
          embed.setDescription(
            truncate(
              incidents
                .map(
                  (incident) =>
                    `**${incident.title}**\nID: ${incident.id}\n状態: ${incident.status} / 緊急度: ${incident.urgency}\nService: ${incident.service}\n作成: ${incident.created_at}\n${incident.html_url}`
                )
                .join('\n\n'),
              4000
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'acknowledge') {
        const incidentId = interaction.options.getString('id', true).trim();
        const incident = await acknowledgeIncident(apiKey, incidentId, email);
        const embed = new EmbedBuilder()
          .setTitle('PagerDuty Incident Acknowledged')
          .setColor(0xfee75c)
          .addFields(
            { name: 'ID', value: incident.id, inline: true },
            { name: 'Status', value: incident.status, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'resolve') {
        const incidentId = interaction.options.getString('id', true).trim();
        const incident = await resolveIncident(apiKey, incidentId, email);
        const embed = new EmbedBuilder()
          .setTitle('PagerDuty Incident Resolved')
          .setColor(0x57f287)
          .addFields(
            { name: 'ID', value: incident.id, inline: true },
            { name: 'Status', value: incident.status, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'services') {
        const services = await listServices(apiKey);
        const embed = new EmbedBuilder()
          .setTitle('PagerDuty Services')
          .setColor(0x5865f2)
          .setTimestamp();

        if (services.length === 0) {
          embed.setDescription('Serviceは見つかりませんでした。');
        } else {
          embed.setDescription(
            truncate(
              services
                .map(
                  (service) =>
                    `**${service.name}**\nID: ${service.id}\n状態: ${service.status}\n${service.html_url}`
                )
                .join('\n\n'),
              4000
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const routingKey = vaultService.getCredential(userId, 'user', 'pagerduty_routing_key');

      if (!routingKey) {
        await interaction.editReply('⚠️ /vault set で pagerduty_routing_key を設定してください');
        return;
      }

      const summary = interaction.options.getString('summary', true).trim();
      const severity = (interaction.options.getString('severity') ?? 'info') as PagerDutySeverity;
      const result = await triggerAlert(apiKey, routingKey, summary, severity);

      const embed = new EmbedBuilder()
        .setTitle('PagerDuty Alert Triggered')
        .setColor(getSeverityColor(severity))
        .addFields(
          { name: 'Severity', value: severity, inline: true },
          { name: 'Status', value: result.status, inline: true },
          { name: 'Dedup Key', value: result.dedup_key || '(none)', inline: false },
          { name: 'Message', value: result.message || '(none)', inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'PagerDuty連携の処理中にエラーが発生しました。');

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
