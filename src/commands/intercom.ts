import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { getContact, getConversations, sendMessage } from '../integrations/intercom';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_ID_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 4000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Intercom認証情報が未設定です')
    .setDescription('/vault set で intercom_access_token を設定してください')
    .setColor(0x286efa);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const intercomCommand = {
  data: new SlashCommandBuilder()
    .setName('intercom')
    .setDescription('Intercomの会話・コンタクトを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('conversations').setDescription('最近の会話一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('contact')
        .setDescription('コンタクト情報を表示します')
        .addStringOption((option) =>
          option
            .setName('id')
            .setDescription('Intercom contact ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reply')
        .setDescription('会話に返信します')
        .addStringOption((option) =>
          option
            .setName('conversation_id')
            .setDescription('Intercom conversation ID')
            .setRequired(true)
            .setMaxLength(MAX_ID_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('返信メッセージ')
            .setRequired(true)
            .setMaxLength(MAX_MESSAGE_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'intercom_access_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'conversations') {
        const conversations = await getConversations(token);
        const embed = new EmbedBuilder().setTitle('Intercom Conversations').setColor(0x286efa);

        if (conversations.length === 0) {
          embed.setDescription('会話は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              conversations.map(
                (conversation) =>
                  `**${conversation.subject}**\nID: ${conversation.id}\n状態: ${conversation.state} / 担当: ${conversation.assignee_name}\n作成: ${conversation.created_at}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'contact') {
        const id = interaction.options.getString('id', true).trim();
        const contact = await getContact(token, id);
        const embed = new EmbedBuilder()
          .setTitle('Intercom Contact')
          .setColor(0x286efa)
          .addFields(
            { name: 'ID', value: contact.id, inline: true },
            { name: 'Name', value: contact.name || '-', inline: true },
            { name: 'Email', value: contact.email || '-', inline: false },
            { name: 'Created At', value: String(contact.created_at), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const conversationId = interaction.options.getString('conversation_id', true).trim();
      const message = interaction.options.getString('message', true).trim();
      await sendMessage(token, conversationId, message);

      const embed = new EmbedBuilder()
        .setTitle('Intercomに返信しました')
        .setColor(0x286efa)
        .addFields(
          { name: 'Conversation ID', value: conversationId, inline: true },
          { name: 'Message', value: truncate(message, 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Intercom連携の処理中にエラーが発生しました。');

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
