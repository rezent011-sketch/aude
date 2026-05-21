import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';

export const lstepCommand = {
  data: new SlashCommandBuilder()
    .setName('lstep')
    .setDescription('LステップWebhookの設定と受信イベント確認を行います')
    .addSubcommand((sub) =>
      sub.setName('setup').setDescription('Webhook URLと設定手順を表示します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Lステップイベントの通知先Discordチャンネルを設定します')
        .addStringOption((o) =>
          o.setName('channel_id').setDescription('通知先チャンネルID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const sub = interaction.options.getSubcommand();

      if (sub === 'setup') {
        const baseUrl = process.env.BASE_URL ?? 'https://your-domain.com';
        const webhookUrl = `${baseUrl}/webhook/lstep`;
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🔗 Lステップ Webhook 設定手順')
              .setDescription(
                [
                  '**1. Lステップ管理画面にログイン**',
                  '**2. 「外部連携」→「Webhook」を開く**',
                  '**3. 以下のURLを設定してください:**',
                  `\`\`\`\n${webhookUrl}\n\`\`\``,
                  '**4. 通知先チャンネルを設定:**',
                  '`/lstep channel channel_id:<チャンネルID>`',
                ].join('\n')
              )
              .setColor(0x00b900)
              .setFooter({ text: 'Lステップからのイベントを自動でDiscordに通知します' }),
          ],
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === 'channel') {
        const channelId = interaction.options.getString('channel_id', true);
        await vaultService.setCredential(interaction.user.id, 'guild', 'lstep_discord_channel_id', channelId);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ 通知先チャンネルを設定しました')
              .setDescription(`Lステップのイベントを <#${channelId}> に通知します。`)
              .setColor(0x00b900),
          ],
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (err) {
      const msg = getErrorMessage(err, 'エラーが発生しました。');
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('❌ エラー').setDescription(msg).setColor(0xed4245)],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
