import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';

export const elmeCommand = {
  data: new SlashCommandBuilder()
    .setName('elme')
    .setDescription('エルメWebhookの設定とLINEイベント受信を行います')
    .addSubcommand((sub) =>
      sub.setName('setup').setDescription('Webhook URLと設定手順を表示します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('エルメイベントの通知先Discordチャンネルを設定します')
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
              .setTitle('🔗 エルメ Webhook 設定手順')
              .setDescription(
                [
                  '**1. エルメ管理画面にログイン**',
                  '**2. 「設定」→「外部Webhook」を開く**',
                  '**3. 以下のURLを設定してください:**',
                  '\`\`\`',
                  `${baseUrl}/webhook/elme`,
                  '\`\`\`',
                  '**4. 通知先チャンネルを設定:**',
                  '`/elme channel channel_id:<チャンネルID>`',
                ].join('\n')
              )
              .setColor(0x06c755)
              .setFooter({ text: 'エルメからのLINEイベントをDiscordに自動通知します' }),
          ],
          flags: MessageFlags.Ephemeral,
        });
      } else if (sub === 'channel') {
        const channelId = interaction.options.getString('channel_id', true);
        await vaultService.setCredential(interaction.user.id, 'guild', 'elme_discord_channel_id', channelId);
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ 通知先チャンネルを設定しました')
              .setDescription(`エルメのイベントを <#${channelId}> に通知します。`)
              .setColor(0x06c755),
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
