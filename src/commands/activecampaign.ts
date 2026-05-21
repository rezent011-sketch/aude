import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { createContact, getContacts, getLists } from '../integrations/activecampaign';
import { getErrorMessage } from '../integrations/errors';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('ActiveCampaign認証情報が未設定です')
    .setDescription('/vault set で activecampaign_api_token, activecampaign_account を設定してください')
    .setColor(0x356ae6);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const activecampaignCommand = {
  data: new SlashCommandBuilder()
    .setName('activecampaign')
    .setDescription('ActiveCampaignのコンタクト・リストを管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('contacts')
        .setDescription('コンタクト一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('lists').setDescription('リスト一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('コンタクトを追加します')
        .addStringOption((option) =>
          option.setName('email').setDescription('メールアドレス').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('first_name').setDescription('名').setRequired(false)
        )
        .addStringOption((option) =>
          option.setName('last_name').setDescription('姓').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'activecampaign_api_token'
      );
      const account = vaultService.getCredential(
        interaction.user.id,
        'user',
        'activecampaign_account'
      );

      if (!token || !account) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'contacts') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const contacts = await getContacts(token, account, limit);
        const embed = new EmbedBuilder()
          .setTitle('ActiveCampaign Contacts')
          .setColor(0x356ae6);

        if (contacts.length === 0) {
          embed.setDescription('コンタクトは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              contacts.map(
                (contact) =>
                  `**${[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '(No name)'}**\nID: ${contact.id}\nEmail: ${contact.email || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'lists') {
        const lists = await getLists(token, account);
        const embed = new EmbedBuilder()
          .setTitle('ActiveCampaign Lists')
          .setColor(0x356ae6);

        if (lists.length === 0) {
          embed.setDescription('リストは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              lists.map(
                (list) =>
                  `**${list.name || '(No name)'}**\nID: ${list.id}\nSubscribers: ${list.subscriberCount}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const email = interaction.options.getString('email', true).trim();
      const firstName = interaction.options.getString('first_name')?.trim();
      const lastName = interaction.options.getString('last_name')?.trim();
      const contact = await createContact(token, account, email, firstName, lastName);

      const embed = new EmbedBuilder()
        .setTitle('ActiveCampaignコンタクトを追加しました')
        .setColor(0x356ae6)
        .addFields(
          { name: 'Contact ID', value: contact.id || '-', inline: true },
          { name: 'Email', value: contact.email, inline: false },
          {
            name: 'Name',
            value: truncate([firstName, lastName].filter(Boolean).join(' ') || '-', 1024),
            inline: false,
          }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(
        error,
        'ActiveCampaign連携の処理中にエラーが発生しました。'
      );

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
