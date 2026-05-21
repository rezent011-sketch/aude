import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getCandidate,
  getCandidates,
  getJobs,
} from '../integrations/talentio';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Talentio アクセストークンが未設定です')
    .setDescription('/vault set key:talentio_access_token value:<token> を実行してください')
    .setColor(0x4caf50);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const talentioCommand = {
  data: new SlashCommandBuilder()
    .setName('talentio')
    .setDescription('Talentioで求人・候補者を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('jobs').setDescription('求人一覧表示')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('candidates')
        .setDescription('候補者一覧')
        .addIntegerOption((option) =>
          option
            .setName('job_id')
            .setDescription('求人IDでフィルタ')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('candidate')
        .setDescription('候補者詳細')
        .addIntegerOption((option) =>
          option.setName('id').setDescription('候補者ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'talentio_access_token'
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

      if (subcommand === 'jobs') {
        const jobs = await getJobs(token);
        const embed = new EmbedBuilder().setTitle('Talentio Jobs').setColor(0x4caf50);

        if (jobs.length === 0) {
          embed.setDescription('求人は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              jobs.map((job) => `**${job.name}**\nID: ${job.id}\nStatus: ${job.status}`)
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'candidates') {
        const jobId = interaction.options.getInteger('job_id') ?? undefined;
        const candidates = await getCandidates(token, jobId);
        const embed = new EmbedBuilder().setTitle('Talentio Candidates').setColor(0x4caf50);

        if (typeof jobId === 'number') {
          embed.addFields({ name: 'Job ID', value: String(jobId), inline: true });
        }

        if (candidates.length === 0) {
          embed.setDescription('候補者は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              candidates.map(
                (candidate) =>
                  `**${candidate.name}**\nID: ${candidate.id}\nStatus: ${candidate.status}\nApplied At: ${candidate.applied_at}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const id = interaction.options.getInteger('id', true);
      const candidate = await getCandidate(token, id);
      const embed = new EmbedBuilder()
        .setTitle(`Talentio Candidate: ${candidate.name}`)
        .setColor(0x4caf50)
        .addFields(
          { name: 'ID', value: String(candidate.id), inline: true },
          { name: 'Status', value: candidate.status || '-', inline: true },
          { name: 'Job', value: candidate.job_name || '-', inline: false },
          { name: 'Email', value: truncate(candidate.email || '-', 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Talentio連携の処理中にエラーが発生しました。');

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
