import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import {
  pushMessage,
  broadcastMessage,
  getProfile,
  getFollowerIds,
  getBotInfo,
} from '../integrations/line';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('LINE Channel Access Tokenが未設定です')
    .setDescription('/vault set key:line_channel_access_token value:<your-token> を実行してください')
    .setColor(0x06c755);
}

export const lineCommand = {
  data: new SlashCommandBuilder()
    .setName('line')
    .setDescription('LINE公式アカウントのメッセージ送信・フォロワー管理を行います')
    .addSubcommand((sub) =>
      sub
        .setName('push')
        .setDescription('特定ユーザーへメッセージを送信します')
        .addStringOption((o) => o.setName('user_id').setDescription('LINE ユーザーID').setRequired(true))
        .addStringOption((o) =>
          o.setName('message').setDescription('送信するメッセージ').setRequired(true).setMaxLength(4000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('broadcast')
        .setDescription('全フォロワーへ一斉配信します')
        .addStringOption((o) =>
          o.setName('message').setDescription('配信するメッセージ').setRequired(true).setMaxLength(4000)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('profile')
        .setDescription('ユーザープロフィールを取得します')
        .addStringOption((o) => o.setName('user_id').setDescription('LINE ユーザーID').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('followers').setDescription('フォロワーID一覧を取得します'))
    .addSubcommand((sub) => sub.setName('botinfo').setDescription('LINE Bot情報を確認します')),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'line_channel_access_token'
      );
      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const sub = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (sub === 'push') {
        const userId = interaction.options.getString('user_id', true);
        const message = interaction.options.getString('message', true);
        await pushMessage(token, userId, message);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ メッセージ送信完了')
              .setDescription(`ユーザー \`${userId}\` にメッセージを送信しました。`)
              .setColor(0x06c755),
          ],
        });
      } else if (sub === 'broadcast') {
        const message = interaction.options.getString('message', true);
        await broadcastMessage(token, message);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ 一斉配信完了')
              .setDescription('全フォロワーへメッセージを配信しました。')
              .setColor(0x06c755),
          ],
        });
      } else if (sub === 'profile') {
        const userId = interaction.options.getString('user_id', true);
        const profile = await getProfile(token, userId);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('👤 LINEユーザープロフィール')
              .addFields(
                { name: '表示名', value: profile.displayName, inline: true },
                { name: 'ステータス', value: truncate(profile.statusMessage || '（なし）', 200), inline: true }
              )
              .setThumbnail(profile.pictureUrl)
              .setColor(0x06c755),
          ],
        });
      } else if (sub === 'followers') {
        const ids = await getFollowerIds(token);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('👥 フォロワーID一覧')
              .setDescription(
                ids.length > 0
                  ? truncate(ids.map((id) => `\`${id}\``).join('\n'), 3800)
                  : 'フォロワーがいません。'
              )
              .setFooter({ text: `合計: ${ids.length}件` })
              .setColor(0x06c755),
          ],
        });
      } else if (sub === 'botinfo') {
        const info = await getBotInfo(token);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🤖 LINE Bot情報')
              .addFields(
                { name: 'Bot名', value: info.displayName, inline: true },
                { name: 'チャットモード', value: info.chatMode, inline: true }
              )
              .setThumbnail(info.pictureUrl)
              .setColor(0x06c755),
          ],
        });
      }
    } catch (err) {
      const msg = getErrorMessage(err, 'LINE APIでエラーが発生しました。');
      const embed = new EmbedBuilder().setTitle('❌ エラー').setDescription(msg).setColor(0xed4245);
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    }
  },
};
