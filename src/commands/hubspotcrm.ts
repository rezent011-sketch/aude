import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createContact,
  getContacts,
  getDeals,
} from '../integrations/hubspotcrm';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_EMAIL_LENGTH = 200;
const MAX_NAME_LENGTH = 200;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('HubSpotアクセストークンが未設定です')
    .setDescription('/vault set key:hubspot_access_token value:<your-token> を実行してください')
    .setColor(0xff7a59);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const hubspotcrmCommand = {
  data: new SlashCommandBuilder()
    .setName('hubspotcrm')
    .setDescription('HubSpot CRMの連絡先・案件を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('contacts')
        .setDescription('連絡先一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deals')
        .setDescription('案件一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('連絡先を追加します')
        .addStringOption((option) =>
          option.setName('email').setDescription('メールアドレス').setRequired(true).setMaxLength(MAX_EMAIL_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('first_name').setDescription('名').setRequired(true).setMaxLength(MAX_NAME_LENGTH)
        )
        .addStringOption((option) =>
          option.setName('last_name').setDescription('姓').setRequired(true).setMaxLength(MAX_NAME_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'hubspot_access_token');

      if (!token) {
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
        const contacts = await getContacts(token, limit);
        const embed = new EmbedBuilder().setTitle('HubSpot Contacts').setColor(0xff7a59);

        if (contacts.length === 0) {
          embed.setDescription('連絡先は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              contacts.map(
                (contact) =>
                  `**${[contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || contact.id}**\nID: ${contact.id}\nEmail: ${contact.email || '-'}\nCompany: ${contact.company || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'deals') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const deals = await getDeals(token, limit);
        const embed = new EmbedBuilder().setTitle('HubSpot Deals').setColor(0xff7a59);

        if (deals.length === 0) {
          embed.setDescription('案件は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              deals.map(
                (deal) =>
                  `**${deal.dealname || '(No name)'}**\nID: ${deal.id}\nAmount: ${deal.amount || '-'}\nStage: ${deal.dealstage || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const email = interaction.options.getString('email', true).trim();
      const firstName = interaction.options.getString('first_name', true).trim();
      const lastName = interaction.options.getString('last_name', true).trim();
      const contact = await createContact(token, email, firstName, lastName);
      const embed = new EmbedBuilder()
        .setTitle('HubSpot連絡先を作成しました')
        .setColor(0xff7a59)
        .addFields(
          { name: 'ID', value: contact.id || '-', inline: true },
          { name: 'Email', value: email, inline: false },
          { name: 'Name', value: `${firstName} ${lastName}`, inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'HubSpot連携の処理中にエラーが発生しました。');

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
