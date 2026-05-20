import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createIssue,
  getTeams,
  listIssues,
  searchIssues,
} from '../integrations/linear';
import vaultService from '../services/vaultService';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_TEAM_ID_LENGTH = 100;
const MAX_QUERY_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Linear APIキーが未設定です')
    .setDescription('まず /vault set key:linear_api_key value:<your-key> を実行してください')
    .setColor(0xff9900);
}

export const linearCommand = {
  data: new SlashCommandBuilder()
    .setName('linear')
    .setDescription('Linearのissueとteamを操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('issues')
        .setDescription('最近のissueを一覧表示します')
        .addStringOption((option) =>
          option
            .setName('team')
            .setDescription('絞り込むteam ID')
            .setRequired(false)
            .setMaxLength(MAX_TEAM_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Linear issueを作成します')
        .addStringOption((option) =>
          option
            .setName('team_id')
            .setDescription('issueを作成するteam ID')
            .setRequired(true)
            .setMaxLength(MAX_TEAM_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('issueタイトル')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('issue説明')
            .setRequired(false)
            .setMaxLength(MAX_DESCRIPTION_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('priority')
            .setDescription('優先度')
            .setRequired(false)
            .addChoices(
              { name: '0 - No priority', value: 0 },
              { name: '1 - Urgent', value: 1 },
              { name: '2 - High', value: 2 },
              { name: '3 - Medium', value: 3 },
              { name: '4 - Low', value: 4 }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('teams').setDescription('team一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('issueを検索します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('検索クエリ')
            .setRequired(true)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'linear_api_key');

      if (!apiKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'issues') {
        const teamId = interaction.options.getString('team')?.trim();
        const issues = await listIssues(apiKey, teamId);
        const embed = new EmbedBuilder()
          .setTitle(teamId ? `Linear Issues (${teamId})` : 'Linear Issues')
          .setColor(0x5e6ad2);

        if (issues.length === 0) {
          embed.setDescription('issueは見つかりませんでした。');
        } else {
          embed.setDescription(
            issues
              .map(
                (issue) =>
                  `**${issue.id}** ${issue.title}\n状態: ${issue.state} / 優先度: ${issue.priority} / 担当: ${issue.assignee ?? '未設定'}\n${issue.url}`
              )
              .join('\n\n')
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create') {
        const title = interaction.options.getString('title', true).trim();
        const description = interaction.options.getString('description')?.trim();
        const teamId = interaction.options.getString('team_id', true).trim();
        const priority = interaction.options.getInteger('priority') ?? undefined;
        const issue = await createIssue(apiKey, {
          title,
          description,
          teamId,
          priority,
        });

        const embed = new EmbedBuilder()
          .setTitle('Linear issueを作成しました')
          .setColor(0x5e6ad2)
          .addFields(
            { name: 'ID', value: issue.id, inline: true },
            { name: 'Title', value: issue.title, inline: false },
            { name: 'URL', value: issue.url, inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'teams') {
        const teams = await getTeams(apiKey);
        const embed = new EmbedBuilder()
          .setTitle('Linear Teams')
          .setColor(0x5e6ad2);

        if (teams.length === 0) {
          embed.setDescription('teamは見つかりませんでした。');
        } else {
          embed.setDescription(
            teams.map((team) => `**${team.name}** (${team.key})\nID: ${team.id}`).join('\n\n')
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const query = interaction.options.getString('query', true).trim();
      const issues = await searchIssues(apiKey, query);
      const embed = new EmbedBuilder()
        .setTitle(`Linear Search: ${query}`)
        .setColor(0x5e6ad2);

      if (issues.length === 0) {
        embed.setDescription('一致するissueは見つかりませんでした。');
      } else {
        embed.setDescription(
          issues
            .map((issue) => `**${issue.id}** ${issue.title}\n状態: ${issue.state}\n${issue.url}`)
            .join('\n\n')
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Linear連携の処理中にエラーが発生しました。');

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
