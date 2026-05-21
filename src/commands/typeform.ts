import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getFormSummary,
  getForms,
  getResponses,
} from '../integrations/typeform';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_FORM_ID_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Typeformアクセストークンが未設定です')
    .setDescription('/vault set key:typeform_access_token value:<token> を実行してください')
    .setColor(0x262627);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function formatAnswerValue(answer: {
  type: string;
  text?: string;
  choice?: { label: string };
}): string {
  if (typeof answer.text === 'string' && answer.text.trim()) {
    return answer.text;
  }

  if (typeof answer.choice?.label === 'string' && answer.choice.label.trim()) {
    return answer.choice.label;
  }

  return answer.type || '-';
}

export const typeformCommand = {
  data: new SlashCommandBuilder()
    .setName('typeform')
    .setDescription('Typeformのフォーム・回答を確認します')
    .addSubcommand((subcommand) =>
      subcommand.setName('forms').setDescription('フォーム一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('responses')
        .setDescription('フォーム回答一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('form_id')
            .setDescription('Typeform form ID')
            .setRequired(true)
            .setMaxLength(MAX_FORM_ID_LENGTH)
        )
        .addIntegerOption((option) =>
          option
            .setName('limit')
            .setDescription('取得件数。未指定時は10')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('summary')
        .setDescription('フォーム概要を表示します')
        .addStringOption((option) =>
          option
            .setName('form_id')
            .setDescription('Typeform form ID')
            .setRequired(true)
            .setMaxLength(MAX_FORM_ID_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'typeform_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'forms') {
        const forms = await getForms(token);
        const embed = new EmbedBuilder().setTitle('Typeform Forms').setColor(0x262627);

        if (forms.length === 0) {
          embed.setDescription('フォームは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              forms.map(
                (form) =>
                  `**${form.title}**\nID: ${form.id}\nLast Updated: ${form.last_updated_at || '-'}\nResponses: ${form.response_count}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'responses') {
        const formId = interaction.options.getString('form_id', true).trim();
        const limit = interaction.options.getInteger('limit') ?? 10;
        const responses = await getResponses(token, formId, limit);
        const embed = new EmbedBuilder()
          .setTitle(`Typeform Responses: ${formId}`)
          .setColor(0x262627)
          .addFields({ name: 'Limit', value: String(limit), inline: true });

        if (responses.length === 0) {
          embed.setDescription('回答は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              responses.map((response) => {
                const answers = response.answers.length
                  ? response.answers
                      .map(
                        (answer) =>
                          `${answer.field.ref || '(no ref)'}: ${truncate(formatAnswerValue(answer), 120)}`
                      )
                      .join('\n')
                  : '回答内容なし';

                return `**${response.submitted_at || '(No submitted_at)'}**\n${answers}`;
              })
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const formId = interaction.options.getString('form_id', true).trim();
      const summary = await getFormSummary(token, formId);
      const embed = new EmbedBuilder()
        .setTitle('Typeform Form Summary')
        .setColor(0x262627)
        .addFields(
          { name: 'ID', value: summary.id || formId, inline: true },
          { name: 'Title', value: summary.title || '-', inline: false },
          { name: 'Responses', value: String(summary.response_count), inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Typeform連携の処理中にエラーが発生しました。');

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
