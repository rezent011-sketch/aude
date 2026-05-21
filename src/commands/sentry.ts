import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getIssues, getOrganizations, getProjects } from '../integrations/sentry';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Sentry認証情報が未設定です')
    .setDescription('/vault set key:sentry_auth_token value:sntrys_... を実行してください')
    .setColor(0x362d59);
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

export const sentryCommand = {
  data: new SlashCommandBuilder()
    .setName('sentry')
    .setDescription('Sentryのエラー・プロジェクトを監視します')
    .addSubcommand((subcommand) =>
      subcommand.setName('orgs').setDescription('organization一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('projects')
        .setDescription('project一覧を表示します')
        .addStringOption((option) =>
          option.setName('org_slug').setDescription('Sentry org slug').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('issues')
        .setDescription('issue一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('target')
            .setDescription('org_slug/project_slug')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'sentry_auth_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'orgs') {
        const organizations = await getOrganizations(token);
        const embed = new EmbedBuilder().setTitle('Sentry Organizations').setColor(0x362d59);

        if (organizations.length === 0) {
          embed.setDescription('organizationは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              organizations.map(
                (organization) =>
                  `**${organization.name}**\nID: ${organization.id}\nSlug: ${organization.slug}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'projects') {
        const orgSlug = interaction.options.getString('org_slug', true).trim();
        const projects = await getProjects(token, orgSlug);
        const embed = new EmbedBuilder()
          .setTitle(`Sentry Projects: ${orgSlug}`)
          .setColor(0x362d59);

        if (projects.length === 0) {
          embed.setDescription('projectは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              projects.map(
                (project) =>
                  `**${project.name}**\nID: ${project.id}\nSlug: ${project.slug}\nPlatform: ${project.platform}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const target = interaction.options.getString('target', true).trim();
      const [orgSlug, projectSlug] = parseScopedValue(target, 'target');
      const issues = await getIssues(token, orgSlug, projectSlug);
      const embed = new EmbedBuilder()
        .setTitle(`Sentry Issues: ${orgSlug}/${projectSlug}`)
        .setColor(0x362d59);

      if (issues.length === 0) {
        embed.setDescription('issueは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            issues.map(
              (issue) =>
                `**${issue.title}**\nID: ${issue.id}\nStatus: ${issue.status} / Level: ${issue.level}\nCount: ${issue.count}\nLast Seen: ${issue.lastSeen || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Sentry連携の処理中にエラーが発生しました。');

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
