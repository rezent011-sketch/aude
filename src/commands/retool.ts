import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getApps, getUsers } from '../integrations/retool';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Retool Access Tokenが未設定です')
    .setDescription('/vault set key:retool_access_token value:<token> を実行してください')
    .setColor(0x3d63dd);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const retoolCommand = {
  data: new SlashCommandBuilder()
    .setName('retool')
    .setDescription('Retoolのアプリ・ユーザーを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('apps').setDescription('アプリ一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('users').setDescription('ユーザー一覧を表示します')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'retool_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'apps') {
        const apps = await getApps(token);
        const embed = new EmbedBuilder().setTitle('Retool Apps').setColor(0x3d63dd);

        if (apps.length === 0) {
          embed.setDescription('アプリは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              apps.map(
                (app) =>
                  `**${app.name}**\nID: ${app.id}\nPage UUID: ${app.pageUuid || '-'}\nCreated: ${app.createdAt || '-'}\nUpdated: ${app.updatedAt || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const users = await getUsers(token);
      const embed = new EmbedBuilder().setTitle('Retool Users').setColor(0x3d63dd);

      if (users.length === 0) {
        embed.setDescription('ユーザーは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            users.map(
              (user) =>
                `**${user.email || '(No email)'}**\nID: ${user.id}\nName: ${[user.firstName, user.lastName].filter(Boolean).join(' ') || '-'}\nRole: ${user.role || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Retool連携の処理中にエラーが発生しました。');

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
