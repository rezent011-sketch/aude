import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { ask } from '../integrations/anthropicapi';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_PROMPT_LENGTH = 4000;
const MAX_MODEL_LENGTH = 100;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Anthropic APIキーが未設定です')
    .setDescription('/vault set key:anthropic_api_key value:sk-ant-... を実行してください')
    .setColor(0xd97757);
}

export const anthropicapiCommand = {
  data: new SlashCommandBuilder()
    .setName('anthropicapi')
    .setDescription('Anthropic Claude APIにメッセージを送信します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('ask')
        .setDescription('Claude APIへ質問します')
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
      const apiKey = vaultService.getCredential(interaction.user.id, 'user', 'anthropic_api_key');

      if (!apiKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const prompt = interaction.options.getString('prompt', true).trim();
      const model = interaction.options.getString('model')?.trim() || 'claude-opus-4-5';
      const maxTokens = interaction.options.getInteger('max_tokens') ?? undefined;
      const result = await ask(apiKey, model, prompt, maxTokens);
      const embed = new EmbedBuilder()
        .setTitle('Anthropic Claude API応答')
        .setColor(0xd97757)
        .setDescription(truncate(result.content || '(empty)', 4000))
        .addFields(
          { name: 'Model', value: result.model, inline: true },
          { name: 'Input Tokens', value: String(result.input_tokens), inline: true },
          { name: 'Output Tokens', value: String(result.output_tokens), inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Anthropic API連携の処理中にエラーが発生しました。');

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
