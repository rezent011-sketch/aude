import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getResponses,
  getSurveyDetails,
  getSurveys,
} from '../integrations/surveymonkey';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('SurveyMonkey access tokenが未設定です')
    .setDescription('/vault set key:surveymonkey_access_token value:<token> を実行してください')
    .setColor(0x00bf6f);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const surveymonkeyCommand = {
  data: new SlashCommandBuilder()
    .setName('surveymonkey')
    .setDescription('SurveyMonkeyのアンケート・回答を確認します')
    .addSubcommand((subcommand) =>
      subcommand.setName('surveys').setDescription('アンケート一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('details')
        .setDescription('アンケート詳細を表示します')
        .addStringOption((option) =>
          option.setName('survey_id').setDescription('Survey ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('responses')
        .setDescription('アンケート回答一覧を表示します')
        .addStringOption((option) =>
          option.setName('survey_id').setDescription('Survey ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'surveymonkey_access_token'
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

      if (subcommand === 'surveys') {
        const surveys = await getSurveys(token);
        const embed = new EmbedBuilder().setTitle('SurveyMonkey Surveys').setColor(0x00bf6f);

        if (surveys.length === 0) {
          embed.setDescription('アンケートは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              surveys.map(
                (survey) =>
                  `**${survey.title}**\nID: ${survey.id}\nResponses: ${survey.response_count}\nCreated: ${survey.date_created || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'details') {
        const surveyId = interaction.options.getString('survey_id', true).trim();
        const details = await getSurveyDetails(token, surveyId);
        const embed = new EmbedBuilder()
          .setTitle('SurveyMonkey Survey Details')
          .setColor(0x00bf6f)
          .addFields(
            { name: 'ID', value: details.id || surveyId, inline: true },
            { name: 'Questions', value: String(details.question_count), inline: true },
            { name: 'Responses', value: String(details.response_count), inline: true },
            { name: 'Title', value: truncate(details.title || '-', 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const surveyId = interaction.options.getString('survey_id', true).trim();
      const responses = await getResponses(token, surveyId);
      const embed = new EmbedBuilder()
        .setTitle(`SurveyMonkey Responses: ${surveyId}`)
        .setColor(0x00bf6f);

      if (responses.length === 0) {
        embed.setDescription('回答は見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            responses.map(
              (response) =>
                `**${response.id || '(No id)'}**\nCreated: ${response.date_created || '-'}\nTotal Time: ${response.total_time}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'SurveyMonkey連携の処理中にエラーが発生しました。');

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
