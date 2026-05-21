import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getFlags, getProjects, toggleFlag } from '../integrations/launchdarkly';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('LaunchDarkly認証情報が未設定です')
    .setDescription('/vault set key:launchdarkly_api_token value:... を実行してください')
    .setColor(0x405bff);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function parseScopedValue(value: string, expectedLabel: string): [string, string] {
  const [left, right, ...rest] = value.split('/').map((part) => part.trim());

  if (!left || !right || rest.length > 0) {
    throw new Error(`${expectedLabel} は "value1/value2" 形式で指定してください。`);
  }

  return [left, right];
}

export const launchdarklyCommand = {
  data: new SlashCommandBuilder()
    .setName('launchdarkly')
    .setDescription('LaunchDarklyのフィーチャーフラグを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('projects').setDescription('project一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('flags')
        .setDescription('flag一覧を表示します')
        .addStringOption((option) =>
          option.setName('project_key').setDescription('LaunchDarkly project key').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle')
        .setDescription('production環境のflagを切り替えます')
        .addStringOption((option) =>
          option
            .setName('target')
            .setDescription('project_key/flag_key')
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('有効にするなら true').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'launchdarkly_api_token'
      );

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'projects') {
        const projects = await getProjects(token);
        const embed = new EmbedBuilder()
          .setTitle('LaunchDarkly Projects')
          .setColor(0x405bff);

        if (projects.length === 0) {
          embed.setDescription('projectは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              projects.map((project) => `**${project.name}**\nKey: ${project.key}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'flags') {
        const projectKey = interaction.options.getString('project_key', true).trim();
        const flags = await getFlags(token, projectKey);
        const embed = new EmbedBuilder()
          .setTitle(`LaunchDarkly Flags: ${projectKey}`)
          .setColor(0x405bff);

        if (flags.length === 0) {
          embed.setDescription('flagは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              flags.map(
                (flag) =>
                  `**${flag.name}**\nKey: ${flag.key}\nKind: ${flag.kind}\nProduction: ${flag.on ? 'on' : 'off'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const target = interaction.options.getString('target', true).trim();
      const enabled = interaction.options.getBoolean('enabled', true);
      const [projectKey, flagKey] = parseScopedValue(target, 'target');
      await toggleFlag(token, projectKey, flagKey, enabled);

      const embed = new EmbedBuilder()
        .setTitle('LaunchDarkly Flag Updated')
        .setColor(0x405bff)
        .addFields(
          { name: 'Project', value: projectKey, inline: true },
          { name: 'Flag', value: flagKey, inline: true },
          { name: 'Production', value: enabled ? 'on' : 'off', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'LaunchDarkly連携の処理中にエラーが発生しました。'
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
