import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getCurrentUser,
  getEventTypes,
  getScheduledEvents,
} from '../integrations/calendly';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Calendlyアクセストークンが未設定です')
    .setDescription('/vault set key:calendly_access_token value:<token> を実行してください')
    .setColor(0x006bff);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const calendlyCommand = {
  data: new SlashCommandBuilder()
    .setName('calendly')
    .setDescription('Calendlyの予約・イベントタイプを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('me').setDescription('現在のユーザー情報を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('event_types').setDescription('イベントタイプ一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('scheduled').setDescription('予約済みイベント一覧を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'calendly_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'me') {
        const user = await getCurrentUser(token);
        const embed = new EmbedBuilder()
          .setTitle('Calendly User')
          .setColor(0x006bff)
          .addFields(
            { name: 'Name', value: user.name || '-', inline: true },
            { name: 'Email', value: user.email || '-', inline: true },
            { name: 'URI', value: user.uri || '-', inline: false },
            { name: 'Scheduling URL', value: user.scheduling_url || '-', inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const user = await getCurrentUser(token);

      if (subcommand === 'event_types') {
        const eventTypes = await getEventTypes(token, user.uri);
        const embed = new EmbedBuilder().setTitle('Calendly Event Types').setColor(0x006bff);

        if (eventTypes.length === 0) {
          embed.setDescription('イベントタイプは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              eventTypes.map(
                (eventType) =>
                  `**${eventType.name}**\nDuration: ${eventType.duration} min\nActive: ${eventType.active ? 'yes' : 'no'}\nURL: ${eventType.scheduling_url || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const events = await getScheduledEvents(token, user.uri);
      const embed = new EmbedBuilder().setTitle('Calendly Scheduled Events').setColor(0x006bff);

      if (events.length === 0) {
        embed.setDescription('予約済みイベントは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            events.map(
              (event) =>
                `**${event.name}**\nStart: ${event.start_time || '-'}\nEnd: ${event.end_time || '-'}\nStatus: ${event.status}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Calendly連携の処理中にエラーが発生しました。');

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
