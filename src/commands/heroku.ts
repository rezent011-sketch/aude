import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getApps, getDynos, restartDynos } from '../integrations/heroku';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Heroku認証情報が未設定です')
    .setDescription('/vault set key:heroku_api_token value:... を実行してください')
    .setColor(0x79589f);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const herokuCommand = {
  data: new SlashCommandBuilder()
    .setName('heroku')
    .setDescription('Herokuのアプリ・Dynoを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('apps').setDescription('app一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('dynos')
        .setDescription('Dyno一覧を表示します')
        .addStringOption((option) =>
          option.setName('app_name').setDescription('Heroku app name').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('restart')
        .setDescription('appのDynoを再起動します')
        .addStringOption((option) =>
          option.setName('app_name').setDescription('Heroku app name').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'heroku_api_token');

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
        const embed = new EmbedBuilder().setTitle('Heroku Apps').setColor(0x79589f);

        if (apps.length === 0) {
          embed.setDescription('appは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              apps.map(
                (app) =>
                  `**${app.name}**\nID: ${app.id}\nStack: ${app.stack}\nRegion: ${app.region}\nURL: ${app.web_url || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'dynos') {
        const appName = interaction.options.getString('app_name', true).trim();
        const dynos = await getDynos(token, appName);
        const embed = new EmbedBuilder()
          .setTitle(`Heroku Dynos: ${appName}`)
          .setColor(0x79589f);

        if (dynos.length === 0) {
          embed.setDescription('Dynoは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              dynos.map(
                (dyno) =>
                  `**${dyno.type}**\nID: ${dyno.id}\nState: ${dyno.state}\nSize: ${dyno.size}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const appName = interaction.options.getString('app_name', true).trim();
      await restartDynos(token, appName);
      const embed = new EmbedBuilder()
        .setTitle('Heroku Dynos Restarted')
        .setColor(0x79589f)
        .addFields({ name: 'App', value: appName, inline: true });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Heroku連携の処理中にエラーが発生しました。');

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
