import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getPipelines, getWorkflows, triggerPipeline } from '../integrations/circleci';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('CircleCI API tokenが未設定です')
    .setDescription('/vault set key:circleci_api_token value:<token> を実行してください')
    .setColor(0x343434);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const circleciCommand = {
  data: new SlashCommandBuilder()
    .setName('circleci')
    .setDescription('CircleCIのパイプライン・ワークフローを管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pipelines')
        .setDescription('パイプライン一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('org_slug')
            .setDescription('GitHub組織/リポジトリ例: gh/org/repo')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('workflows')
        .setDescription('ワークフロー一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('pipeline_id')
            .setDescription('CircleCI pipeline ID')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('trigger')
        .setDescription('パイプラインを起動します')
        .addStringOption((option) =>
          option
            .setName('org_slug')
            .setDescription('GitHub組織/リポジトリ例: gh/org/repo')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('branch').setDescription('対象ブランチ。未指定時はmain').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'circleci_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'pipelines') {
        const orgSlug = interaction.options.getString('org_slug', true).trim();
        const pipelines = await getPipelines(token, orgSlug);
        const embed = new EmbedBuilder().setTitle('CircleCI Pipelines').setColor(0x343434);

        if (pipelines.length === 0) {
          embed.setDescription('パイプラインは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              pipelines.map(
                (pipeline) =>
                  `**#${pipeline.number}**\nID: ${pipeline.id}\nState: ${pipeline.state || '-'}\nCreated: ${pipeline.created_at || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'workflows') {
        const pipelineId = interaction.options.getString('pipeline_id', true).trim();
        const workflows = await getWorkflows(token, pipelineId);
        const embed = new EmbedBuilder()
          .setTitle(`CircleCI Workflows: ${pipelineId}`)
          .setColor(0x343434);

        if (workflows.length === 0) {
          embed.setDescription('ワークフローは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              workflows.map(
                (workflow) =>
                  `**${workflow.name}**\nID: ${workflow.id}\nStatus: ${workflow.status || '-'}\nCreated: ${workflow.created_at || '-'}\nStopped: ${workflow.stopped_at || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const orgSlug = interaction.options.getString('org_slug', true).trim();
      const branch = interaction.options.getString('branch')?.trim() || 'main';
      const pipeline = await triggerPipeline(token, orgSlug, branch);
      const embed = new EmbedBuilder()
        .setTitle('CircleCIパイプラインを起動しました')
        .setColor(0x343434)
        .addFields(
          { name: 'Org Slug', value: orgSlug, inline: false },
          { name: 'Branch', value: branch, inline: true },
          { name: 'Pipeline ID', value: pipeline.id || '-', inline: true },
          { name: 'Number', value: String(pipeline.number), inline: true },
          { name: 'State', value: pipeline.state || '-', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'CircleCI連携の処理中にエラーが発生しました。');

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
