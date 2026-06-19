import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import {
  checkIntegrationStatus,
  getIntegration,
  listAvailableIntegrations,
  type IntegrationName,
} from '../integrations';
import { getErrorMessage } from '../integrations/errors';
import { splitMessage } from '../utils/discord';

const INTEGRATION_CHOICES = listAvailableIntegrations().map((integration) => ({
  name: integration.displayName,
  value: integration.name,
}));

async function replyWithParts(
  interaction: ChatInputCommandInteraction,
  content: string
): Promise<void> {
  const parts = splitMessage(content);

  await interaction.editReply(parts[0] ?? '結果がありません。');

  for (let index = 1; index < parts.length; index += 1) {
    await interaction.followUp({
      content: parts[index],
      flags: MessageFlags.Ephemeral,
    });
  }
}

function formatStatusLine(name: IntegrationName): string {
  const status = checkIntegrationStatus(name);
  const integration = getIntegration(name);

  if (!integration) {
    return `- ${name}: 未知の連携`;
  }

  if (status.isConfigured) {
    return `- ${integration.displayName}: 設定済み`;
  }

  return `- ${integration.displayName}: 未設定 (${status.missingEnvVars.join(', ')})`;
}

export const connectCommand = {
  data: new SlashCommandBuilder()
    .setName('connect')
    .setDescription('外部ツール連携の一覧・状態・設定ガイドを表示します')
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('利用可能な連携一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('各連携のAPIキー設定状況を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('指定した連携の設定ガイドを表示します')
        .addStringOption((option) =>
          option
            .setName('integration')
            .setDescription('設定したい連携')
            .setRequired(true)
            .addChoices(...INTEGRATION_CHOICES)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'list') {
        const lines = listAvailableIntegrations().map(
          (integration) =>
            `- ${integration.displayName} (${integration.name}): ${integration.description}`
        );
        await replyWithParts(
          interaction,
          ['利用可能な連携:', ...lines].join('\n')
        );
        return;
      }

      if (subcommand === 'status') {
        const lines = listAvailableIntegrations().map((integration) =>
          formatStatusLine(integration.name)
        );
        await replyWithParts(
          interaction,
          ['連携ステータス:', ...lines].join('\n')
        );
        return;
      }

      const integrationName = interaction.options.getString(
        'integration',
        true
      ) as IntegrationName;
      const integration = getIntegration(integrationName);

      if (!integration) {
        await interaction.editReply('指定した連携は見つかりませんでした。');
        return;
      }

      const status = checkIntegrationStatus(integrationName);
      const content = [
        `${integration.displayName} 設定ガイド`,
        '',
        `状態: ${status.isConfigured ? '設定済み' : '未設定'}`,
        ...(!status.isConfigured
          ? [`不足している環境変数: ${status.missingEnvVars.join(', ')}`, '']
          : ['']),
        ...integration.setupInstructions.map((line) => `- ${line}`),
      ].join('\n');

      await replyWithParts(interaction, content);
    } catch (error) {
      const message = getErrorMessage(
        error,
        'connect コマンドの処理中にエラーが発生しました。'
      );
      await interaction.editReply(`⚠️ ${message}`);
    }
  },
};
