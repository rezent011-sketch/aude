import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getMetrics,
  listAlerts,
  listDashboards,
  postEvent,
} from '../integrations/datadog';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_QUERY_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 4000;

type DatadogEventPriority = 'normal' | 'low';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Datadog認証情報が未設定です')
    .setDescription('/vault set で datadog_api_key と datadog_app_key を設定してください')
    .setColor(0xff9900);
}

function getStatusColor(status: string): number {
  const normalized = status.trim().toLowerCase();

  if (normalized.includes('alert')) {
    return 0xed4245;
  }

  if (normalized.includes('warn')) {
    return 0xfee75c;
  }

  if (normalized === 'ok') {
    return 0x57f287;
  }

  if (normalized.includes('no data')) {
    return 0x95a5a6;
  }

  return 0x5865f2;
}

function formatMetricPoints(pointlist: Array<[number, number | null]>): string {
  if (pointlist.length === 0) {
    return 'データポイントなし';
  }

  const recentPoints = pointlist
    .slice(-5)
    .map(([timestamp, value]) => `${new Date(timestamp).toISOString()}: ${value ?? 'null'}`);

  return truncate(recentPoints.join('\n'), 1000);
}

export const datadogCommand = {
  data: new SlashCommandBuilder()
    .setName('datadog')
    .setDescription('Datadog monitor、metric、dashboard、eventを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('alerts').setDescription('Active monitor/alert を一覧表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('metrics')
        .setDescription('Metric query を実行します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription("例: avg:system.cpu.user{*}")
            .setRequired(true)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('dashboards').setDescription('Dashboard一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('event')
        .setDescription('Datadog event を投稿します')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('Event title')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('text')
            .setDescription('Event text')
            .setRequired(true)
            .setMaxLength(MAX_TEXT_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('priority')
            .setDescription('Event priority')
            .setRequired(false)
            .addChoices(
              { name: 'normal', value: 'normal' },
              { name: 'low', value: 'low' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const apiKey = vaultService.getCredential(userId, 'user', 'datadog_api_key');
      const appKey = vaultService.getCredential(userId, 'user', 'datadog_app_key');

      if (!apiKey || !appKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'alerts') {
        const alerts = await listAlerts(apiKey, appKey);
        const embed = new EmbedBuilder()
          .setTitle('Datadog Alerts')
          .setColor(alerts.length > 0 ? getStatusColor(alerts[0].status) : 0x5865f2)
          .setTimestamp();

        if (alerts.length === 0) {
          embed.setDescription('Monitorは見つかりませんでした。');
        } else {
          embed.setDescription(
            truncate(
              alerts
                .map(
                  (alert) =>
                    `**${alert.name}**\nID: ${alert.id}\n状態: ${alert.status} / Priority: ${alert.priority}\n${alert.url}\n${truncate(alert.message || '(no message)', 200)}`
                )
                .join('\n\n'),
              4000
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'metrics') {
        const query = interaction.options.getString('query', true).trim();
        const metrics = await getMetrics(apiKey, appKey, query);
        const embed = new EmbedBuilder()
          .setTitle('Datadog Metrics')
          .setColor(0x3498db)
          .addFields({ name: 'Query', value: truncate(query, 1024), inline: false })
          .setTimestamp();

        if (metrics.series.length === 0) {
          embed.setDescription('Metric series は見つかりませんでした。');
        } else {
          embed.addFields(
            metrics.series.slice(0, 5).map((series) => ({
              name: truncate(series.metric, 256),
              value: formatMetricPoints(series.pointlist),
              inline: false,
            }))
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'dashboards') {
        const dashboards = await listDashboards(apiKey, appKey);
        const embed = new EmbedBuilder()
          .setTitle('Datadog Dashboards')
          .setColor(0x5865f2)
          .setTimestamp();

        if (dashboards.length === 0) {
          embed.setDescription('Dashboardは見つかりませんでした。');
        } else {
          embed.setDescription(
            truncate(
              dashboards
                .map(
                  (dashboard) =>
                    `**${dashboard.title}**\nID: ${dashboard.id}\nPopularity: ${dashboard.popularity}\n${dashboard.url}`
                )
                .join('\n\n'),
              4000
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const title = interaction.options.getString('title', true).trim();
      const text = interaction.options.getString('text', true).trim();
      const priority = (interaction.options.getString('priority') ?? 'normal') as DatadogEventPriority;
      const result = await postEvent(apiKey, appKey, {
        title,
        text,
        priority,
      });

      const embed = new EmbedBuilder()
        .setTitle('Datadog Event Posted')
        .setColor(0x57f287)
        .addFields(
          { name: 'Title', value: truncate(title, 1024), inline: false },
          { name: 'Priority', value: priority, inline: true },
          { name: 'Status', value: result.status, inline: true }
        )
        .setDescription(truncate(text, 4000));

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Datadog連携の処理中にエラーが発生しました。');

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
