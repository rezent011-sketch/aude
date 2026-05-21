import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { createPage, getSpaces, searchPages } from '../integrations/confluence';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_QUERY_LENGTH = 200;
const MAX_SPACE_KEY_LENGTH = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Confluence認証情報が未設定です')
    .setDescription(
      '/vault set で confluence_email, confluence_api_token, confluence_domain を設定してください'
    )
    .setColor(0x0052cc);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const confluenceCommand = {
  data: new SlashCommandBuilder()
    .setName('confluence')
    .setDescription('Confluenceのスペース・ページを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('spaces').setDescription('スペース一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('ページを検索します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('検索キーワード')
            .setRequired(true)
            .setMaxLength(MAX_QUERY_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('ページを作成します')
        .addStringOption((option) =>
          option
            .setName('space_key')
            .setDescription('Confluence space key')
            .setRequired(true)
            .setMaxLength(MAX_SPACE_KEY_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('ページタイトル')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('body')
            .setDescription('storage formatの本文')
            .setRequired(true)
            .setMaxLength(MAX_BODY_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const userId = interaction.user.id;
      const email = vaultService.getCredential(userId, 'user', 'confluence_email');
      const token = vaultService.getCredential(userId, 'user', 'confluence_api_token');
      const domain = vaultService.getCredential(userId, 'user', 'confluence_domain');

      if (!email || !token || !domain) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'spaces') {
        const spaces = await getSpaces(email, token, domain);
        const embed = new EmbedBuilder().setTitle('Confluence Spaces').setColor(0x0052cc);

        if (spaces.length === 0) {
          embed.setDescription('スペースは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              spaces.map(
                (space) =>
                  `**${space.key}** ${space.name}\nID: ${space.id}\nType: ${space.type}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'search') {
        const query = interaction.options.getString('query', true).trim();
        const pages = await searchPages(email, token, domain, query);
        const embed = new EmbedBuilder()
          .setTitle('Confluence Search')
          .setColor(0x0052cc)
          .addFields({ name: 'Query', value: query, inline: false });

        if (pages.length === 0) {
          embed.setDescription('一致するページは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              pages.map(
                (page) =>
                  `**${page.title}**\nID: ${page.id}\nSpace: ${page.spaceKey || '-'}\n${page.url || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const spaceKey = interaction.options.getString('space_key', true).trim();
      const title = interaction.options.getString('title', true).trim();
      const body = interaction.options.getString('body', true).trim();
      const page = await createPage(email, token, domain, spaceKey, title, body);
      const embed = new EmbedBuilder()
        .setTitle('Confluenceページを作成しました')
        .setColor(0x0052cc)
        .addFields(
          { name: 'Space', value: spaceKey, inline: true },
          { name: 'ID', value: page.id || '-', inline: true },
          { name: 'Title', value: page.title || title, inline: false },
          { name: 'URL', value: page.url || '-', inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Confluence連携の処理中にエラーが発生しました。');

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
