import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  chat,
  listModels,
} from '../integrations/openaiapi';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_PROMPT_LENGTH = 4000;
const MAX_MODEL_LENGTH = 100;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('OpenAI APIキーが未設定です')
    .setDescription('/vault set key:openai_api_key value:sk-... を実行してください')
    .setColor(0x10a37f);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const openaiapiCommand = {
  data: new SlashCommandBuilder()
    .setName('openaiapi')
    .setDescription('OpenAI APIのモデル一覧確認・チャットを行います')
    .addSubcommand((subcommand) =>
      subcommand.setName('models').setDescription('利用可能なモデル一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('chat')
        .setDescription('OpenAI APIにチャットを送信します')
        .addStringOption((option) =>
          option.setName('prompt').setDescription('入力プロンプト').setRequired(true).setMaxLength(MAX_PROMPT_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('model').setDescription('モデル名').setRequired(false).setMaxLength(MAX_MODEL_LENGTH)
        )
        .addIntegerOption((option) =>
          option.setName('max_tokens').setDescription('最大出力トークン').setRequired(false).setMinValue(1)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'openai_api_key');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'models') {
        const models = await listModels(token);
        const embed = new EmbedBuilder().setTitle('OpenAI Models').setColor(0x10a37f);

        if (models.length === 0) {
          embed.setDescription('モデルは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(models.map((model) => `**${model.id}**\nOwned by: ${model.owned_by || '-'}`))
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const prompt = interaction.options.getString('prompt', true).trim();
      const model = interaction.options.getString('model')?.trim() || 'gpt-4o-mini';
      const maxTokens = interaction.options.getInteger('max_tokens') ?? undefined;
      const result = await chat(token, model, prompt, maxTokens);
      const embed = new EmbedBuilder()
        .setTitle('OpenAI API応答')
        .setColor(0x10a37f)
        .setDescription(truncate(result.content || '(empty)', 4000))
        .addFields(
          { name: 'Model', value: model, inline: true },
          { name: 'Prompt Tokens', value: String(result.usage.prompt_tokens), inline: true },
          { name: 'Completion Tokens', value: String(result.usage.completion_tokens), inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'OpenAI API連携の処理中にエラーが発生しました。');

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
