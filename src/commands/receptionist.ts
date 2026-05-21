import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createVisitorNotification,
  getVisitor,
  getVisitors,
} from '../integrations/receptionist';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('RECEPTIONIST API tokenが未設定です')
    .setDescription('/vault set key:receptionist_api_token value:<token> を実行してください')
    .setColor(0x00b4d8);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const receptionistCommand = {
  data: new SlashCommandBuilder()
    .setName('receptionist')
    .setDescription('RECEPTIONISTの来客管理を行います')
    .addSubcommand((subcommand) =>
      subcommand.setName('visitors').setDescription('来客一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('visitor')
        .setDescription('来客詳細を表示します')
        .addStringOption((option) =>
          option.setName('id').setDescription('来客ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('notify')
        .setDescription('来客通知を作成します')
        .addStringOption((option) =>
          option.setName('host_name').setDescription('担当者名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('visitor_name').setDescription('来客名').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('company').setDescription('会社名').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(
        interaction.user.id,
        'user',
        'receptionist_api_token'
      );

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'visitors') {
        const visitors = await getVisitors(token);
        const embed = new EmbedBuilder().setTitle('RECEPTIONIST Visitors').setColor(0x00b4d8);

        if (visitors.length === 0) {
          embed.setDescription('来客は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              visitors.map(
                (visitor) =>
                  `**${visitor.visitor_name}**\nID: ${visitor.id}\nCompany: ${visitor.company || '-'}\nHost: ${visitor.host_name || '-'}\nChecked In: ${visitor.checked_in_at || '-'}\nStatus: ${visitor.status}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'visitor') {
        const id = interaction.options.getString('id', true).trim();
        const visitor = await getVisitor(token, id);
        const embed = new EmbedBuilder()
          .setTitle(`RECEPTIONIST Visitor: ${id}`)
          .setColor(0x00b4d8)
          .addFields(
            { name: 'Visitor', value: visitor.visitor_name || '-', inline: true },
            { name: 'Company', value: visitor.company || '-', inline: true },
            { name: 'Host', value: visitor.host_name || '-', inline: true },
            { name: 'Checked In', value: visitor.checked_in_at || '-', inline: false },
            { name: 'Purpose', value: truncate(visitor.purpose || '-', 1024), inline: false }
          );

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const hostName = interaction.options.getString('host_name', true).trim();
      const visitorName = interaction.options.getString('visitor_name', true).trim();
      const company = interaction.options.getString('company', true).trim();
      const notification = await createVisitorNotification(token, hostName, visitorName, company);

      const embed = new EmbedBuilder()
        .setTitle('RECEPTIONIST来客通知を作成しました')
        .setColor(0x00b4d8)
        .addFields(
          { name: 'Notification ID', value: notification.id, inline: true },
          { name: 'Host', value: hostName, inline: true },
          { name: 'Visitor', value: visitorName, inline: true },
          { name: 'Company', value: company, inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'RECEPTIONIST連携の処理中にエラーが発生しました。');

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
