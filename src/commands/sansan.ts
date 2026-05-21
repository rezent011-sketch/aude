import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getContact, getContacts } from '../integrations/sansan';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_KEYWORD_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Sansan APIトークンが未設定です')
    .setDescription('/vault set key:sansan_api_token value:<token> を実行してください')
    .setColor(0xff6600);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const sansanCommand = {
  data: new SlashCommandBuilder()
    .setName('sansan')
    .setDescription('Sansanの名刺・連絡先を検索・参照します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('名刺を検索します')
        .addStringOption((option) =>
          option
            .setName('keyword')
            .setDescription('検索キーワード（名前・会社名等）')
            .setRequired(false)
            .setMaxLength(MAX_KEYWORD_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('contact')
        .setDescription('名刺詳細を表示します')
        .addStringOption((option) =>
          option.setName('id').setDescription('Sansan bizCard ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'sansan_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'search') {
        const keyword = interaction.options.getString('keyword')?.trim();
        const contacts = await getContacts(token, keyword);
        const embed = new EmbedBuilder().setTitle('Sansan Contacts').setColor(0xff6600);

        if (keyword) {
          embed.addFields({ name: 'Keyword', value: truncate(keyword, 1024), inline: false });
        }

        if (contacts.length === 0) {
          embed.setDescription('名刺は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              contacts.map(
                (contact) =>
                  `**${contact.name}**\nID: ${contact.id}\nCompany: ${contact.company}\nEmail: ${contact.email || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const id = interaction.options.getString('id', true).trim();
      const contact = await getContact(token, id);
      const embed = new EmbedBuilder()
        .setTitle('Sansan Contact')
        .setColor(0xff6600)
        .addFields(
          { name: 'ID', value: contact.id || id, inline: true },
          { name: 'Name', value: contact.name || '-', inline: true },
          { name: 'Company', value: contact.company || '-', inline: false },
          { name: 'Title', value: contact.title || '-', inline: false },
          { name: 'Email', value: contact.email || '-', inline: false },
          { name: 'Tel', value: contact.tel || '-', inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Sansan連携の処理中にエラーが発生しました。');

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
