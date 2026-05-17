import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import {
  createRepositoryIssue,
  listRepositoryIssues,
} from '../integrations/github';
import { getErrorMessage } from '../integrations/errors';
import { splitMessage, truncate } from '../utils/discord';

const MAX_REPOSITORY_LENGTH = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 4000;

export const githubCommand = {
  data: new SlashCommandBuilder()
    .setName('github')
    .setDescription('GitHub issueを確認・作成します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('issues')
        .setDescription('リポジトリのopen issue一覧を取得します')
        .addStringOption((option) =>
          option
            .setName('repository')
            .setDescription('owner/repo 形式のリポジトリ名')
            .setRequired(true)
            .setMaxLength(MAX_REPOSITORY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create-issue')
        .setDescription('GitHub issueを作成します')
        .addStringOption((option) =>
          option
            .setName('repository')
            .setDescription('owner/repo 形式のリポジトリ名')
            .setRequired(true)
            .setMaxLength(MAX_REPOSITORY_LENGTH)
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
            .setName('body')
            .setDescription('issue本文')
            .setRequired(true)
            .setMaxLength(MAX_BODY_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'issues') {
        const repository = interaction.options.getString('repository', true).trim();
        const issues = await listRepositoryIssues(repository);

        if (issues.length === 0) {
          await interaction.editReply(`${repository} にopen issueは見つかりませんでした。`);
          return;
        }

        const content = [
          `${repository} のopen issue: ${issues.length}件`,
          ...issues.map((issue) =>
            [`#${issue.number} ${truncate(issue.title, 120)}`, `作成者: ${issue.author}`, issue.url].join('\n')
          ),
        ].join('\n\n');
        const parts = splitMessage(content, 1900);

        await interaction.editReply(parts[0]);

        for (let index = 1; index < parts.length; index += 1) {
          await interaction.followUp({
            content: parts[index],
            flags: MessageFlags.Ephemeral,
          });
        }

        return;
      }

      const repository = interaction.options.getString('repository', true).trim();
      const title = interaction.options.getString('title', true).trim();
      const body = interaction.options.getString('body', true).trim();
      const issue = await createRepositoryIssue(repository, title, body);

      await interaction.editReply(
        [`GitHub issueを作成しました。`, `#${issue.number} ${issue.title}`, issue.url].join('\n')
      );
    } catch (error) {
      const message = getErrorMessage(error, 'GitHub連携の処理中にエラーが発生しました。');

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`⚠️ ${message}`);
        return;
      }

      await interaction.reply({
        content: `⚠️ ${message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
