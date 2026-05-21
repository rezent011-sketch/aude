import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createCalendarEvent,
  getCalendarEvents,
  getContacts,
} from '../integrations/rakumo';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_TITLE_LENGTH = 200;
const MAX_ATTENDEES_LENGTH = 1000;
const MAX_KEYWORD_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Rakumo APIトークンが未設定です')
    .setDescription('/vault set key:rakumo_api_token value:<token> を実行してください')
    .setColor(0x0066ff);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function parseCommaSeparatedEmails(input: string | null): string[] {
  return (input ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export const rakumoCommand = {
  data: new SlashCommandBuilder()
    .setName('rakumo')
    .setDescription('Rakumoのカレンダー・コンタクトを操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('events')
        .setDescription('カレンダーイベント一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('start')
            .setDescription('開始日 YYYY-MM-DD')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('end').setDescription('終了日 YYYY-MM-DD').setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create_event')
        .setDescription('カレンダーイベントを作成します')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('イベントタイトル')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('start')
            .setDescription('YYYY-MM-DDTHH:MM')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('end').setDescription('YYYY-MM-DDTHH:MM').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('attendees')
            .setDescription('メールアドレスをカンマ区切りで')
            .setRequired(false)
            .setMaxLength(MAX_ATTENDEES_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('contacts')
        .setDescription('コンタクトを検索します')
        .addStringOption((option) =>
          option
            .setName('keyword')
            .setDescription('検索キーワード')
            .setRequired(false)
            .setMaxLength(MAX_KEYWORD_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'rakumo_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'events') {
        const start = interaction.options.getString('start')?.trim() ?? '';
        const end = interaction.options.getString('end')?.trim() ?? '';
        const events = await getCalendarEvents(token, start, end);
        const embed = new EmbedBuilder().setTitle('Rakumo Calendar Events').setColor(0x0066ff);

        embed.addFields(
          { name: 'Start', value: start || '-', inline: true },
          { name: 'End', value: end || '-', inline: true }
        );

        if (events.length === 0) {
          embed.setDescription('イベントは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              events.map(
                (event) =>
                  `**${event.title}**\nID: ${event.id}\nStart: ${event.start || '-'}\nEnd: ${event.end || '-'}\nOrganizer: ${event.organizer || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create_event') {
        const title = interaction.options.getString('title', true).trim();
        const start = interaction.options.getString('start', true).trim();
        const end = interaction.options.getString('end', true).trim();
        const attendeesInput = interaction.options.getString('attendees');
        const attendees = parseCommaSeparatedEmails(attendeesInput);
        const event = await createCalendarEvent(token, title, start, end, attendees);

        const embed = new EmbedBuilder()
          .setTitle('Rakumo カレンダーイベントを作成しました')
          .setColor(0x0066ff)
          .addFields(
            { name: 'ID', value: event.id || '-', inline: true },
            { name: 'Title', value: truncate(event.title, 1024), inline: false },
            { name: 'Start', value: start, inline: true },
            { name: 'End', value: end, inline: true }
          );

        if (attendees.length > 0) {
          embed.addFields({
            name: 'Attendees',
            value: truncate(attendees.join(', '), 1024),
            inline: false,
          });
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const keyword = interaction.options.getString('keyword')?.trim();
      const contacts = await getContacts(token, keyword);
      const embed = new EmbedBuilder().setTitle('Rakumo Contacts').setColor(0x0066ff);

      if (keyword) {
        embed.addFields({ name: 'Keyword', value: truncate(keyword, 1024), inline: false });
      }

      if (contacts.length === 0) {
        embed.setDescription('コンタクトは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            contacts.map(
              (contact) =>
                `**${contact.name}**\nID: ${contact.id}\nEmail: ${contact.email || '-'}\nCompany: ${contact.company || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Rakumo連携の処理中にエラーが発生しました。');

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
