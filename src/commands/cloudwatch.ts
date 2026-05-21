import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getAlarms, getMetricStatistics } from '../integrations/cloudwatch';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const DEFAULT_REGION = 'ap-northeast-1';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('AWS認証情報が未設定です')
    .setDescription(
      '/vault set で aws_access_key_id と aws_secret_access_key を設定してください'
    )
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const cloudwatchCommand = {
  data: new SlashCommandBuilder()
    .setName('cloudwatch')
    .setDescription('AWS CloudWatchのアラーム・メトリクスを確認します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('alarms')
        .setDescription('アラーム一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription(`AWS region。省略時は ${DEFAULT_REGION}`)
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('metrics')
        .setDescription('メトリクス統計を表示します')
        .addStringOption((option) =>
          option.setName('namespace').setDescription('CloudWatch namespace').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('metric_name').setDescription('CloudWatch metric name').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription(`AWS region。省略時は ${DEFAULT_REGION}`)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const accessKeyId = vaultService.getCredential(
        interaction.user.id,
        'user',
        'aws_access_key_id'
      );
      const secretKey = vaultService.getCredential(
        interaction.user.id,
        'user',
        'aws_secret_access_key'
      );

      if (!accessKeyId || !secretKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'alarms') {
        const region = interaction.options.getString('region')?.trim() || DEFAULT_REGION;
        const alarms = await getAlarms(accessKeyId, secretKey, region);
        const embed = new EmbedBuilder().setTitle('AWS CloudWatch Alarms').setColor(0xff9900);

        if (alarms.length === 0) {
          embed.setDescription('アラームは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              alarms.map(
                (alarm) =>
                  `**${alarm.AlarmName || '(No name)'}**\nState: ${alarm.StateValue || '-'}\nMetric: ${alarm.Namespace || '-'}/${alarm.MetricName || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const namespace = interaction.options.getString('namespace', true).trim();
      const metricName = interaction.options.getString('metric_name', true).trim();
      const region = interaction.options.getString('region')?.trim() || DEFAULT_REGION;
      const metrics = await getMetricStatistics(
        accessKeyId,
        secretKey,
        region,
        namespace,
        metricName
      );
      const embed = new EmbedBuilder()
        .setTitle('AWS CloudWatch Metrics')
        .setColor(0xff9900)
        .addFields(
          { name: 'Region', value: region, inline: true },
          { name: 'Namespace', value: namespace, inline: true },
          { name: 'Metric', value: metricName, inline: true }
        );

      if (metrics.length === 0) {
        embed.setDescription('メトリクスは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            metrics.map(
              (metric) => `**${metric.Timestamp || '(No timestamp)'}**\nAverage: ${metric.Average}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'AWS CloudWatch連携の処理中にエラーが発生しました。'
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
