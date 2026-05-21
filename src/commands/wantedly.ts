import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getApplicants,
  getCompanyProfile,
  getJobPostings,
} from '../integrations/wantedly';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Wantedlyアクセストークンが未設定です')
    .setDescription('/vault set key:wantedly_access_token value:<token> を実行してください')
    .setColor(0x21bcab);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const wantedlyCommand = {
  data: new SlashCommandBuilder()
    .setName('wantedly')
    .setDescription('Wantedlyの求人・応募者を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('profile').setDescription('企業プロフィールを表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('jobs').setDescription('求人一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('applicants')
        .setDescription('応募者一覧を表示します')
        .addIntegerOption((option) =>
          option
            .setName('job_id')
            .setDescription('求人ID')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'wantedly_access_token'
      );

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'profile') {
        const profile = await getCompanyProfile(token);
        const embed = new EmbedBuilder()
          .setTitle('Wantedly Company Profile')
          .setColor(0x21bcab)
          .addFields(
            { name: 'ID', value: String(profile.id), inline: true },
            { name: 'Name', value: profile.name || '-', inline: true },
            {
              name: 'Description',
              value: truncate(profile.description || '-', 1024),
              inline: false,
            }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'jobs') {
        const jobs = await getJobPostings(token);
        const embed = new EmbedBuilder().setTitle('Wantedly Jobs').setColor(0x21bcab);

        if (jobs.length === 0) {
          embed.setDescription('求人は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              jobs.map(
                (job) =>
                  `**${job.title}**\nID: ${job.id}\nStatus: ${job.status}\nApplicants: ${job.applicants_count}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const jobId = interaction.options.getInteger('job_id', true);
      const applicants = await getApplicants(token, jobId);
      const embed = new EmbedBuilder()
        .setTitle(`Wantedly Applicants: ${jobId}`)
        .setColor(0x21bcab)
        .addFields({ name: 'Job ID', value: String(jobId), inline: true });

      if (applicants.length === 0) {
        embed.setDescription('応募者は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            applicants.map(
              (applicant) =>
                `**${applicant.name}**\nID: ${applicant.id}\nStatus: ${applicant.status}\nApplied At: ${applicant.applied_at}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Wantedly連携の処理中にエラーが発生しました。');

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
