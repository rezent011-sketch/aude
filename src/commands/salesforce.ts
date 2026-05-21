import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createLead, getAccounts, getOpportunities } from '../integrations/salesforce';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Salesforce認証情報が未設定です')
    .setDescription('/vault set で salesforce_access_token, salesforce_instance_url を設定してください')
    .setColor(0x00a1e0);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const salesforceCommand = {
  data: new SlashCommandBuilder()
    .setName('salesforce')
    .setDescription('Salesforceの取引先・商談・リードを管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('accounts').setDescription('取引先一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('opportunities').setDescription('商談一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('lead')
        .setDescription('リードを作成します')
        .addStringOption((option) =>
          option.setName('first_name').setDescription('名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('last_name').setDescription('姓').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('company').setDescription('会社名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('email').setDescription('メールアドレス').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'salesforce_access_token'
      );
      const instance = vaultService.getCredential(
        interaction.user.id,
        'user',
        'salesforce_instance_url'
      );

      if (!token || !instance) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'accounts') {
        const accounts = await getAccounts(token, instance);
        const embed = new EmbedBuilder().setTitle('Salesforce Accounts').setColor(0x00a1e0);

        if (accounts.length === 0) {
          embed.setDescription('取引先は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              accounts.map(
                (account) =>
                  `**${account.Name || '(No name)'}**\nID: ${account.Id}\nIndustry: ${account.Industry || '-'}\nAnnual Revenue: ${account.AnnualRevenue || 0}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'opportunities') {
        const opportunities = await getOpportunities(token, instance);
        const embed = new EmbedBuilder()
          .setTitle('Salesforce Opportunities')
          .setColor(0x00a1e0);

        if (opportunities.length === 0) {
          embed.setDescription('商談は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              opportunities.map(
                (opportunity) =>
                  `**${opportunity.Name || '(No name)'}**\nID: ${opportunity.Id}\nStage: ${opportunity.StageName || '-'}\nAmount: ${opportunity.Amount || 0}\nClose Date: ${opportunity.CloseDate || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const firstName = interaction.options.getString('first_name', true).trim();
      const lastName = interaction.options.getString('last_name', true).trim();
      const company = interaction.options.getString('company', true).trim();
      const email = interaction.options.getString('email', true).trim();
      const lead = await createLead(token, instance, firstName, lastName, company, email);

      const embed = new EmbedBuilder()
        .setTitle('Salesforceリードを作成しました')
        .setColor(0x00a1e0)
        .addFields(
          { name: 'Lead ID', value: lead.id || '-', inline: true },
          { name: 'Success', value: lead.success ? 'true' : 'false', inline: true },
          { name: 'Name', value: truncate(`${firstName} ${lastName}`.trim(), 1024), inline: false },
          { name: 'Company', value: truncate(company, 1024), inline: false },
          { name: 'Email', value: email, inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Salesforce連携の処理中にエラーが発生しました。');

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
