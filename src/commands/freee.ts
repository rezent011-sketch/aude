import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  getCompanies,
  listAccountItems,
  listDeals,
  listPartners,
} from '../integrations/freee';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Freee認証情報が未設定です')
    .setDescription(
      'Freee連携はOAuth2が必要です。/vault set key:freee_access_token value:<token> と /vault set key:freee_company_id value:<id> を設定してください'
    )
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function getDealColor(type: 'income' | 'expense'): number {
  return type === 'income' ? 0x57f287 : 0xed4245;
}

export const freeeCommand = {
  data: new SlashCommandBuilder()
    .setName('freee')
    .setDescription('Freeeのcompany、deal、partner、account itemを参照します')
    .addSubcommand((subcommand) =>
      subcommand.setName('companies').setDescription('接続済みcompany一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('deals')
        .setDescription('最近のdeal一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('company_id').setDescription('Freee company ID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('deal typeで絞り込み')
            .setRequired(false)
            .addChoices(
              { name: 'income', value: 'income' },
              { name: 'expense', value: 'expense' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('partners')
        .setDescription('取引先一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('company_id').setDescription('Freee company ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('accounts')
        .setDescription('勘定科目一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('company_id').setDescription('Freee company ID').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const accessToken = vaultService.getCredential(interaction.user.id, 'user', 'freee_access_token');
      const storedCompanyId = vaultService.getCredential(interaction.user.id, 'user', 'freee_company_id');

      if (!accessToken || !storedCompanyId) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'companies') {
        const companies = await getCompanies(accessToken);
        const embed = new EmbedBuilder().setTitle('Freee Companies').setColor(0x1abc9c);

        if (companies.length === 0) {
          embed.setDescription('companyは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              companies.map(
                (company) =>
                  `**${company.display_name}**\nID: ${company.id}\nName: ${company.name}\nRole: ${company.role}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'deals') {
        const companyId = interaction.options.getInteger('company_id', true);
        const typeFilter = interaction.options.getString('type') as 'income' | 'expense' | null;
        const deals = await listDeals(accessToken, companyId);
        const filteredDeals = typeFilter ? deals.filter((deal) => deal.type === typeFilter) : deals;
        const embed = new EmbedBuilder()
          .setTitle(`Freee Deals: ${companyId}`)
          .setColor(getDealColor(typeFilter ?? 'income'));

        if (typeFilter) {
          embed.addFields({ name: 'Type', value: typeFilter, inline: true });
        }

        if (filteredDeals.length === 0) {
          embed.setDescription('dealは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              filteredDeals.map(
                (deal) =>
                  `**${deal.partner_name}**\nID: ${deal.id}\nDate: ${deal.issue_date} / Type: ${deal.type} / Status: ${deal.status}\nAmount: ${deal.amount} / Due: ${deal.due_amount}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'partners') {
        const companyId = interaction.options.getInteger('company_id', true);
        const partners = await listPartners(accessToken, companyId);
        const embed = new EmbedBuilder()
          .setTitle(`Freee Partners: ${companyId}`)
          .setColor(0x3498db);

        if (partners.length === 0) {
          embed.setDescription('partnerは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              partners.map(
                (partner) =>
                  `**${partner.name}**\nID: ${partner.id}\nCode: ${partner.code}\nEmail: ${partner.email}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const companyId = interaction.options.getInteger('company_id', true);
      const accountItems = await listAccountItems(accessToken, companyId);
      const embed = new EmbedBuilder()
        .setTitle(`Freee Account Items: ${companyId}`)
        .setColor(0xf1c40f);

      if (accountItems.length === 0) {
        embed.setDescription('account itemは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            accountItems.map(
              (accountItem) =>
                `**${accountItem.name}**\nID: ${accountItem.id}\nShortcut: ${accountItem.shortcut1}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Freee連携の処理中にエラーが発生しました。');

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
