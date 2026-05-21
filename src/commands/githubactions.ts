import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  listRuns,
  listWorkflows,
  triggerWorkflow,
} from '../integrations/githubactions';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_OWNER_LENGTH = 100;
const MAX_REPO_LENGTH = 100;
const MAX_WORKFLOW_ID_LENGTH = 200;
const MAX_REF_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('GitHub Tokenが未設定です')
    .setDescription('/vault set key:github_token value:ghp_... を実行してください')
    .setColor(0x24292f);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const githubactionsCommand = {
  data: new SlashCommandBuilder()
    .setName('githubactions')
    .setDescription('GitHub Actionsのワークフロー・実行履歴を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('workflows')
        .setDescription('ワークフロー一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('owner')
            .setDescription('GitHub owner')
            .setRequired(true)
            .setMaxLength(MAX_OWNER_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('repo')
            .setDescription('GitHub repository name')
            .setRequired(true)
            .setMaxLength(MAX_REPO_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('runs')
        .setDescription('実行履歴を表示します')
        .addStringOption((option) =>
          option
            .setName('owner')
            .setDescription('GitHub owner')
            .setRequired(true)
            .setMaxLength(MAX_OWNER_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('repo')
            .setDescription('GitHub repository name')
            .setRequired(true)
            .setMaxLength(MAX_REPO_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('workflow_id')
            .setDescription('workflow IDで絞り込みます')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('trigger')
        .setDescription('ワークフローを実行します')
        .addStringOption((option) =>
          option
            .setName('owner')
            .setDescription('GitHub owner')
            .setRequired(true)
            .setMaxLength(MAX_OWNER_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('repo')
            .setDescription('GitHub repository name')
            .setRequired(true)
            .setMaxLength(MAX_REPO_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('workflow_id')
            .setDescription('workflow ID or filename')
            .setRequired(true)
            .setMaxLength(MAX_WORKFLOW_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('ref')
            .setDescription('実行対象ref。省略時はmain')
            .setRequired(false)
            .setMaxLength(MAX_REF_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'github_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      const owner = interaction.options.getString('owner', true).trim();
      const repo = interaction.options.getString('repo', true).trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'workflows') {
        const workflows = await listWorkflows(token, owner, repo);
        const embed = new EmbedBuilder()
          .setTitle(`GitHub Actions Workflows: ${owner}/${repo}`)
          .setColor(0x24292f);

        if (workflows.length === 0) {
          embed.setDescription('ワークフローは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              workflows.map(
                (workflow) =>
                  `**${workflow.name || '(No name)'}**\nID: ${workflow.id}\nState: ${workflow.state || '-'}\nPath: ${workflow.path || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'runs') {
        const workflowId = interaction.options.getInteger('workflow_id') ?? undefined;
        const runs = await listRuns(token, owner, repo, workflowId);
        const embed = new EmbedBuilder()
          .setTitle(`GitHub Actions Runs: ${owner}/${repo}`)
          .setColor(0x24292f);

        if (workflowId) {
          embed.addFields({ name: 'Workflow ID', value: String(workflowId), inline: true });
        }

        if (runs.length === 0) {
          embed.setDescription('実行履歴は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              runs.map(
                (run) =>
                  `**${run.name || '(No name)'}**\nID: ${run.id}\nStatus: ${run.status || '-'} / Conclusion: ${run.conclusion || '-'}\nCreated: ${run.created_at || '-'}\n${run.html_url || ''}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const workflowId = interaction.options.getString('workflow_id', true).trim();
      const ref = interaction.options.getString('ref')?.trim();
      await triggerWorkflow(token, owner, repo, workflowId, ref);

      const embed = new EmbedBuilder()
        .setTitle('GitHub Actions Workflow Triggered')
        .setColor(0x24292f)
        .addFields(
          { name: 'Repository', value: `${owner}/${repo}`, inline: true },
          { name: 'Workflow', value: workflowId, inline: true },
          { name: 'Ref', value: ref || 'main', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'GitHub Actions連携の処理中にエラーが発生しました。'
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
