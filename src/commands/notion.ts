import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { createNotionPage, searchNotionPages } from '../integrations/notion';
import { getErrorMessage } from '../integrations/errors';
import { splitMessage, truncate } from '../utils/discord';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 4000;
const MAX_KEYWORD_LENGTH = 200;

export const notionCommand = {
  data: new SlashCommandBuilder()
    .setName('notion')
    .setDescription('Notionページを検索・作成します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('キーワードでNotionページを検索します')
        .addStringOption((option) =>
          option
            .setName('keyword')
            .setDescription('検索キーワード')
            .setRequired(true)
            .setMaxLength(MAX_KEYWORD_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Notionデータベースにページを作成します')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('ページタイトル')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('ページ本文')
            .setRequired(true)
            .setMaxLength(MAX_CONTENT_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'search') {
        const keyword = interaction.options.getString('keyword', true).trim();
        const pages = await searchNotionPages(keyword);

        if (pages.length === 0) {
          await interaction.editReply(`「${keyword}」に一致するNotionページは見つかりませんでした。`);
          return;
        }

        const content = [
          `Notion検索結果: ${pages.length}件`,
          ...pages.slice(0, 10).map((page, index) =>
            [
              `${index + 1}. ${truncate(page.title, 120)}`,
              `更新: ${new Date(page.lastEditedTime).toLocaleString('ja-JP', { hour12: false })}`,
              page.url,
            ].join('\n')
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

      const title = interaction.options.getString('title', true).trim();
      const content = interaction.options.getString('content', true).trim();
      const page = await createNotionPage(title, content);

      await interaction.editReply(
        [`Notionページを作成しました。`, `タイトル: ${title}`, page.url].join('\n')
      );
    } catch (error) {
      const message = getErrorMessage(error, 'Notion連携の処理中にエラーが発生しました。');

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
