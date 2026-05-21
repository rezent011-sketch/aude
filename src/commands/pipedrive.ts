import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createDeal, getDeals, getPersons } from '../integrations/pipedrive';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Pipedrive API tokenが未設定です')
    .setDescription('/vault set key:pipedrive_api_token value:<token> を実行してください')
    .setColor(0x1f7244);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const pipedriveCommand = {
  data: new SlashCommandBuilder()
    .setName('pipedrive')
    .setDescription('Pipedriveの案件・連絡先を管理します')
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
        .setName('persons')
        .setDescription('連絡先一覧を表示します')
        .addIntegerOption((option) =>
          option.setName('limit').setDescription('取得件数').setRequired(false).setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('案件を作成します')
        .addStringOption((option) =>
          option.setName('title').setDescription('案件名').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('value').setDescription('金額').setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'pipedrive_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'deals') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const deals = await getDeals(token, limit);
        const embed = new EmbedBuilder().setTitle('Pipedrive Deals').setColor(0x1f7244);

        if (deals.length === 0) {
          embed.setDescription('案件は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              deals.map(
                (deal) =>
                  `**${deal.title || '(No title)'}**\nID: ${deal.id}\nStatus: ${deal.status || '-'}\nValue: ${deal.value || 0} ${deal.currency || ''}\nOrg: ${deal.org_name || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'persons') {
        const limit = interaction.options.getInteger('limit') ?? undefined;
        const persons = await getPersons(token, limit);
        const embed = new EmbedBuilder().setTitle('Pipedrive Persons').setColor(0x1f7244);

        if (persons.length === 0) {
          embed.setDescription('連絡先は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              persons.map(
                (person) =>
                  `**${person.name || '(No name)'}**\nID: ${person.id}\nEmail: ${person.email || '-'}\nPhone: ${person.phone || '-'}\nOrg: ${person.org_name || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const title = interaction.options.getString('title', true).trim();
      const value = interaction.options.getInteger('value') ?? undefined;
      const deal = await createDeal(token, title, value);
      const embed = new EmbedBuilder()
        .setTitle('Pipedrive案件を作成しました')
        .setColor(0x1f7244)
        .addFields(
          { name: 'Deal ID', value: String(deal.id), inline: true },
          { name: 'Title', value: truncate(deal.title, 1024), inline: false },
          { name: 'Value', value: String(value ?? 0), inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Pipedrive連携の処理中にエラーが発生しました。');

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
