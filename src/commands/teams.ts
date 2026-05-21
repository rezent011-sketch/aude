import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getChannels, getTeams, sendMessage } from '../integrations/teams';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_TEAM_ID_LENGTH = 200;
const MAX_CHANNEL_ID_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Microsoft Teamsアクセストークンが未設定です')
    .setDescription('/vault set key:teams_access_token value:... を実行してください')
    .setColor(0x6264a7);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const teamsCommand = {
  data: new SlashCommandBuilder()
    .setName('teams')
    .setDescription('Microsoft Teamsのチーム・チャンネル・メッセージを操作します')
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('チーム一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channels')
        .setDescription('チームのチャンネル一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('team_id')
            .setDescription('Microsoft Teams team ID')
            .setRequired(true)
            .setMaxLength(MAX_TEAM_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('send')
        .setDescription('チャンネルにメッセージを送信します')
        .addStringOption((option) =>
          option
            .setName('team_id')
            .setDescription('Microsoft Teams team ID')
            .setRequired(true)
            .setMaxLength(MAX_TEAM_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('channel_id')
            .setDescription('Microsoft Teams channel ID')
            .setRequired(true)
            .setMaxLength(MAX_CHANNEL_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('送信するメッセージ')
            .setRequired(true)
            .setMaxLength(MAX_MESSAGE_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'teams_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'list') {
        const teams = await getTeams(token);
        const embed = new EmbedBuilder().setTitle('Microsoft Teams').setColor(0x6264a7);

        if (teams.length === 0) {
          embed.setDescription('チームは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              teams.map(
                (team) =>
                  `**${team.displayName}**\nID: ${team.id}\nDescription: ${team.description || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'channels') {
        const teamId = interaction.options.getString('team_id', true).trim();
        const channels = await getChannels(token, teamId);
        const embed = new EmbedBuilder()
          .setTitle(`Microsoft Teams Channels: ${teamId}`)
          .setColor(0x6264a7);

        if (channels.length === 0) {
          embed.setDescription('チャンネルは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              channels.map(
                (channel) =>
                  `**${channel.displayName}**\nID: ${channel.id}\nMembership: ${channel.membershipType}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const teamId = interaction.options.getString('team_id', true).trim();
      const channelId = interaction.options.getString('channel_id', true).trim();
      const message = interaction.options.getString('message', true).trim();
      await sendMessage(token, teamId, channelId, message);

      const embed = new EmbedBuilder()
        .setTitle('Microsoft Teamsにメッセージを送信しました')
        .setColor(0x6264a7)
        .addFields(
          { name: 'Team ID', value: teamId, inline: true },
          { name: 'Channel ID', value: channelId, inline: true },
          { name: 'Message', value: truncate(message, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Microsoft Teams連携の処理中にエラーが発生しました。');

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
