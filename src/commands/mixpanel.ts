import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getFunnels, getTopEvents } from '../integrations/mixpanel';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Mixpanel認証情報が未設定です')
    .setDescription(
      '/vault set key:mixpanel_service_account value:<service_account> と /vault set key:mixpanel_secret value:<secret> を設定してください'
    )
    .setColor(0x7856ff);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const mixpanelCommand = {
  data: new SlashCommandBuilder()
    .setName('mixpanel')
    .setDescription('Mixpanelのイベント分析・ファネルを確認します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('events')
        .setDescription('過去7日間の上位イベントを表示します')
        .addStringOption((option) =>
          option.setName('project_id').setDescription('Mixpanel project ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('funnels')
        .setDescription('ファネル一覧を表示します')
        .addStringOption((option) =>
          option.setName('project_id').setDescription('Mixpanel project ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const username = vaultService.getCredential(
        interaction.user.id,
        'user',
        'mixpanel_service_account'
      );
      const secret = vaultService.getCredential(interaction.user.id, 'user', 'mixpanel_secret');

      if (!username || !secret) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const projectId = interaction.options.getString('project_id', true).trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'events') {
        const events = await getTopEvents(username, secret, projectId);
        const embed = new EmbedBuilder()
          .setTitle(`Mixpanel Top Events: ${projectId}`)
          .setColor(0x7856ff);

        if (events.length === 0) {
          embed.setDescription('イベントは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              events.map((entry) => `**${entry.event}**\nCount: ${entry.count}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const funnels = await getFunnels(username, secret, projectId);
      const embed = new EmbedBuilder()
        .setTitle(`Mixpanel Funnels: ${projectId}`)
        .setColor(0x7856ff);

      if (funnels.length === 0) {
        embed.setDescription('ファネルは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            funnels.map((entry) => `**${entry.name}**\nFunnel ID: ${entry.funnel_id}`)
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Mixpanel連携の処理中にエラーが発生しました。');

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
