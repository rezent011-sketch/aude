import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import alertService from '../services/alertService';
import { Alert } from '../db/alertRepository';

function requireGuildContext(interaction: ChatInputCommandInteraction): { guildId: string; channelId: string } {
  if (!interaction.guildId || !interaction.channelId) {
    throw new Error('このコマンドはサーバーチャンネルでのみ利用できます。');
  }

  return {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  };
}

function buildAlertListEmbed(alerts: Alert[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('プロアクティブ通知一覧')
    .setTimestamp();

  if (alerts.length === 0) {
    embed.setDescription('登録されているアラートはありません。');
    return embed;
  }

  embed.setDescription(`登録済みアラート: ${alerts.length}件`);
  embed.addFields(
    alerts.slice(0, 25).map((alert) => ({
      name: `#${alert.id} ${alert.name}`,
      value: [
        `条件: ${alert.condition}`,
        `状態: ${alert.isActive ? '有効' : '停止中'}`,
        `種別: ${alert.alertType}`,
        `実行回数: ${alert.triggerCount}`,
      ].join('\n'),
      inline: false,
    }))
  );

  return embed;
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'アラート処理中にエラーが発生しました。しばらくしてから再度お試しください。';
}

export const alertCommand = {
  data: new SlashCommandBuilder()
    .setName('alert')
    .setDescription('プロアクティブ通知を設定します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('新しいアラートを追加します')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('アラート名')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName('condition')
            .setDescription('実行条件（例: every day at 9am / 毎日9時）')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('通知メッセージ')
            .setRequired(true)
            .setMaxLength(1000)
        )
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('アラート種別')
            .setRequired(false)
            .addChoices(
              { name: 'keyword', value: 'keyword' },
              { name: 'schedule', value: 'schedule' },
              { name: 'threshold', value: 'threshold' },
              { name: 'reminder', value: 'reminder' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('このサーバーのアラートを一覧表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('アラートを停止します')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('対象のアラートID')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('アラートを有効化または停止します')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('対象のアラートID')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const { guildId, channelId } = requireGuildContext(interaction);
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'add') {
        const name = interaction.options.getString('name', true).trim();
        const condition = interaction.options.getString('condition', true).trim();
        const message = interaction.options.getString('message', true).trim();
        const type = interaction.options.getString('type') as Alert['alertType'] | null;

        const alert = await alertService.addAlert({
          guildId,
          channelId,
          createdBy: interaction.user.id,
          type: type ?? undefined,
          name,
          condition,
          message,
        });

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('プロアクティブ通知を登録しました')
          .addFields(
            { name: 'ID', value: String(alert.id), inline: true },
            { name: '名前', value: alert.name, inline: true },
            { name: '種別', value: alert.alertType, inline: true },
            { name: '条件', value: alert.condition, inline: false },
            { name: 'cron', value: `\`${alert.cronExpr ?? alertService.conditionToCron(alert.condition)}\``, inline: false },
            { name: '送信先', value: `<#${channelId}>`, inline: false }
          )
          .setDescription(alert.message.slice(0, 4000))
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === 'list') {
        const alerts = alertService.listAlerts(guildId);
        await interaction.reply({
          embeds: [buildAlertListEmbed(alerts)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const id = interaction.options.getInteger('id', true);

      if (subcommand === 'remove') {
        const removed = await alertService.removeAlert(id, guildId);
        await interaction.reply({
          content: removed
            ? `🗑️ アラート #${id} を停止しました。`
            : `❌ アラート #${id} が見つかりません。`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (subcommand === 'toggle') {
        const updated = await alertService.toggleAlert(id, guildId);
        await interaction.reply({
          content: updated
            ? `${updated.isActive ? '▶️' : '⏸️'} アラート #${updated.id} を${updated.isActive ? '有効化' : '停止'}しました。`
            : `❌ アラート #${id} が見つかりません。`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (error) {
      const message = toUserErrorMessage(error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply({ content: `⚠️ ${message}`, flags: MessageFlags.Ephemeral });
    }
  },
};
