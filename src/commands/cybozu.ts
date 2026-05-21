import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createSchedule,
  getBulletinBoards,
  getSchedules,
} from '../integrations/cybozu';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Cybozu Office認証情報が未設定です')
    .setDescription('cybozu_login, cybozu_password, cybozu_subdomain を /vault set で設定してください')
    .setColor(0xd71920);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const cybozuCommand = {
  data: new SlashCommandBuilder()
    .setName('cybozu')
    .setDescription('Cybozu Officeのスケジュール・掲示板を操作します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('schedule')
        .setDescription('指定日のスケジュール一覧')
        .addStringOption((option) =>
          option
            .setName('date')
            .setDescription('日付 YYYY-MM-DD形式、省略時は今日')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create_schedule')
        .setDescription('スケジュール作成')
        .addStringOption((option) =>
          option.setName('subject').setDescription('件名').setRequired(true)
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
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('boards').setDescription('掲示板カテゴリ一覧')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const login = vaultService.getCredential(interaction.user.id, 'user', 'cybozu_login');
      const password = vaultService.getCredential(interaction.user.id, 'user', 'cybozu_password');
      const subdomain = vaultService.getCredential(interaction.user.id, 'user', 'cybozu_subdomain');

      if (!login || !password || !subdomain) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'schedule') {
        const date = interaction.options.getString('date')?.trim() || formatDateString(new Date());
        const schedules = await getSchedules(login, password, subdomain, date);
        const embed = new EmbedBuilder()
          .setTitle(`Cybozu Schedules: ${date}`)
          .setColor(0xd71920);

        if (schedules.length === 0) {
          embed.setDescription('スケジュールは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              schedules.map(
                (schedule) =>
                  `**${schedule.subject}**\nID: ${schedule.id}\nStart: ${schedule.start || '-'}\nEnd: ${schedule.end || '-'}\nMembers: ${schedule.members.length > 0 ? schedule.members.join(', ') : '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'create_schedule') {
        const subject = interaction.options.getString('subject', true).trim();
        const start = interaction.options.getString('start', true).trim();
        const end = interaction.options.getString('end', true).trim();
        const schedule = await createSchedule(login, password, subdomain, subject, start, end);
        const embed = new EmbedBuilder()
          .setTitle('Cybozu Officeでスケジュールを作成しました')
          .setColor(0xd71920)
          .addFields(
            { name: 'ID', value: schedule.id, inline: true },
            { name: 'Subject', value: truncate(subject, 1024), inline: false },
            { name: 'Start', value: start, inline: true },
            { name: 'End', value: end, inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const boards = await getBulletinBoards(login, password, subdomain);
      const embed = new EmbedBuilder().setTitle('Cybozu Bulletin Boards').setColor(0xd71920);

      if (boards.length === 0) {
        embed.setDescription('掲示板カテゴリは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(boards.map((board) => `**${board.name}**\nID: ${board.id}`))
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Cybozu Office連携の処理中にエラーが発生しました。');

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
