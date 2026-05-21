import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { createPerson, getOpportunities, searchPeople } from '../integrations/copper';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('Copper認証情報が未設定です')
    .setDescription(
      '/vault set key:copper_api_token value:<token> と /vault set key:copper_user_email value:user@example.com を設定してください'
    )
    .setColor(0xea8b04);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const copperCommand = {
  data: new SlashCommandBuilder()
    .setName('copper')
    .setDescription('Copper CRMの連絡先・商談を管理します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('people')
        .setDescription('連絡先を検索します')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('メールアドレスで検索。未指定時は最新一覧')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('opportunities').setDescription('商談一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('連絡先を追加します')
        .addStringOption((option) =>
          option.setName('name').setDescription('氏名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('email').setDescription('メールアドレス').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'copper_api_token');
      const userEmail = vaultService.getCredential(
        interaction.user.id,
        'user',
        'copper_user_email'
      );

      if (!token || !userEmail) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'people') {
        const query = interaction.options.getString('query')?.trim() || '';
        const people = await searchPeople(token, query, userEmail);
        const embed = new EmbedBuilder().setTitle('Copper People').setColor(0xea8b04);

        if (query) {
          embed.addFields({ name: 'Query', value: query, inline: false });
        }

        if (people.length === 0) {
          embed.setDescription('連絡先は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              people.map(
                (person) =>
                  `**${person.name}**\nID: ${person.id}\nEmail: ${person.email || '-'}\nCompany: ${person.company_name || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'opportunities') {
        const opportunities = await getOpportunities(token, userEmail);
        const embed = new EmbedBuilder().setTitle('Copper Opportunities').setColor(0xea8b04);

        if (opportunities.length === 0) {
          embed.setDescription('商談は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              opportunities.map(
                (opportunity) =>
                  `**${opportunity.name}**\nID: ${opportunity.id}\nStatus: ${opportunity.status || '-'}\nValue: ${opportunity.monetary_value}\nClose Date: ${opportunity.close_date || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const name = interaction.options.getString('name', true).trim();
      const email = interaction.options.getString('email', true).trim();
      const person = await createPerson(token, userEmail, name, email);
      const embed = new EmbedBuilder()
        .setTitle('Copper連絡先を作成しました')
        .setColor(0xea8b04)
        .addFields(
          { name: 'Person ID', value: String(person.id), inline: true },
          { name: 'Name', value: truncate(person.name || name, 1024), inline: false },
          { name: 'Email', value: email, inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'Copper連携の処理中にエラーが発生しました。');

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
