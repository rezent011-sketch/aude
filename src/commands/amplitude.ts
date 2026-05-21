import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getActiveUsers, getEventCounts } from '../integrations/amplitude';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Amplitude認証情報が未設定です')
    .setDescription(
      '/vault set key:amplitude_api_key value:<api_key> と /vault set key:amplitude_secret_key value:<secret_key> を設定してください'
    )
    .setColor(0x1a1aff);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatYYYYMMDD(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateOffset(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return formatYYYYMMDD(date);
}

export const amplitudeCommand = {
  data: new SlashCommandBuilder()
    .setName('amplitude')
    .setDescription('Amplitudeのユーザー分析・イベント計測を確認します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('users')
        .setDescription('アクティブユーザー数を日別で確認します')
        .addStringOption((option) =>
          option
            .setName('start')
            .setDescription('開始日 YYYYMMDD形式。省略時は過去7日')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('end')
            .setDescription('終了日 YYYYMMDD形式。省略時は今日')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('events')
        .setDescription('イベント発生件数を日別で確認します')
        .addStringOption((option) =>
          option.setName('event_name').setDescription('イベント名').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('start')
            .setDescription('開始日 YYYYMMDD形式。省略時は過去7日')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('end')
            .setDescription('終了日 YYYYMMDD形式。省略時は今日')
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'amplitude_api_key');
      const secretKey = vaultService.getCredential(
        interaction.user.id,
        'user',
        'amplitude_secret_key'
      );

      if (!apiKey || !secretKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const start = interaction.options.getString('start')?.trim() || formatDateOffset(7);
      const end = interaction.options.getString('end')?.trim() || formatDateOffset(0);
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'users') {
        const users = await getActiveUsers(apiKey, secretKey, start, end);
        const embed = new EmbedBuilder().setTitle('Amplitude Active Users').setColor(0x1a1aff);

        embed.addFields(
          { name: 'Start', value: start, inline: true },
          { name: 'End', value: end, inline: true }
        );

        if (users.length === 0) {
          embed.setDescription('ユーザーデータは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(users.map((entry) => `**${entry.date}**\nUsers: ${entry.value}`))
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const eventName = interaction.options.getString('event_name', true).trim();
      const events = await getEventCounts(apiKey, secretKey, eventName, start, end);
      const embed = new EmbedBuilder().setTitle(`Amplitude Event: ${eventName}`).setColor(0x1a1aff);

      embed.addFields(
        { name: 'Start', value: start, inline: true },
        { name: 'End', value: end, inline: true }
      );

      if (events.length === 0) {
        embed.setDescription('イベントデータは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(events.map((entry) => `**${entry.date}**\nCount: ${entry.count}`))
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Amplitude連携の処理中にエラーが発生しました。');

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
