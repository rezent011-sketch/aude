import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';

export const lmessageCommand = {
  data: new SlashCommandBuilder()
    .setName('lmessage')
    .setDescription('LメッセージWebhookの設定とLINEイベント受信を行います')
    .addSubcommand((sub) =>
      sub.setName('setup').setDescription('Webhook URLと設定手順を表示します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Lメッセージイベントの通知先Discordチャンネルを設定します')
        .addStringOption((o) =>
          o.setName('channel_id').setDescription('通知先チャンネルID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const sub = interaction.options.getSubcommand();

      if (sub === 'setup') {
        const baseUrl = process.env.BASE_URL ?? 'https://your-domain.com';
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🔗 Lメッセージ Webhook 設定手順')
              .setDescription(
                [
                  '**1. Lメッセージ管理画面にログイン**',
                  '**2. 「設定」→「外部Webhook」を開く**',
                  '**3. 以下のURLを設定してください:**',
                  '\`\`\`',
                  `${baseUrl}/webhook/lmessage`,
                  '\`\`\`',
                  '**4. 通知先チャンネルを設定:**',
                  '`/lmessage channel channel_id:<チャンネルID>`',
                  '',
                  '**対応イベント:** フォロー・ブロック・メッセージ・ボタンタップ・リッチメニュー',
                ].join('\n')
              )
              .setColor(0x00b900)
              .setFooter({ text: 'LメッセージのLINEイベントをリアルタイムでDiscordに通知します' }),
          ],
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === 'channel') {
        const channelId = interaction.options.getString('channel_id', true);
        await vaultService.setCredential(interaction.user.id, 'guild', 'lmessage_discord_channel_id', channelId);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ 通知先チャンネルを設定しました')
              .setDescription(`Lメッセージのイベントを <#${channelId}> に通知します。`)
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
