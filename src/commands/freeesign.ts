import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import {
  createContract,
  getContract,
  getContracts,
} from '../integrations/freeesign';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const MAX_TITLE_LENGTH = 200;
const MAX_SIGNERS_LENGTH = 1000;

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('freeeサイン APIトークンが未設定です')
    .setDescription('/vault set key:freeesign_api_token value:<token> を実行してください')
    .setColor(0x00c4a7);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

function parseCommaSeparatedEmails(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export const freeesignCommand = {
  data: new SlashCommandBuilder()
    .setName('freeesign')
    .setDescription('freeeサインの電子契約書を管理します')
    .addSubcommand((subcommand) =>
      subcommand.setName('contracts').setDescription('契約書一覧を表示します')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('contract')
        .setDescription('契約書詳細を表示します')
        .addStringOption((option) =>
          option.setName('id').setDescription('契約書ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('契約書を作成します')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('契約書タイトル')
            .setRequired(true)
            .setMaxLength(MAX_TITLE_LENGTH)
        )
        .addStringOption((option) =>
          option
            .setName('signers')
            .setDescription('署名者メールアドレスをカンマ区切りで')
            .setRequired(true)
            .setMaxLength(MAX_SIGNERS_LENGTH)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const token = vaultService.getCredential(interaction.user.id, 'user', 'freeesign_api_token');

      if (!token) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'contracts') {
        const contracts = await getContracts(token);
        const embed = new EmbedBuilder().setTitle('freeeサイン 契約書一覧').setColor(0x00c4a7);

        if (contracts.length === 0) {
          embed.setDescription('契約書は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              contracts.slice(0, 10).map(
                (contract) =>
                  `**${contract.title}**\nID: ${contract.id}\nStatus: ${contract.status}\nCreated: ${contract.created_at || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (subcommand === 'contract') {
        const id = interaction.options.getString('id', true).trim();
        const contract = await getContract(token, id);
        const embed = new EmbedBuilder()
          .setTitle(`freeeサイン 契約書詳細: ${contract.title}`)
          .setColor(0x00c4a7)
          .addFields(
            { name: 'ID', value: contract.id || id, inline: true },
            { name: 'Status', value: contract.status || '-', inline: true }
          );

        if (contract.signers.length === 0) {
          embed.setDescription('署名者は見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              contract.signers.map(
                (signer) =>
                  `**${signer.email}**\nStatus: ${signer.status}\nSigned At: ${signer.signed_at || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const title = interaction.options.getString('title', true).trim();
      const signersInput = interaction.options.getString('signers', true).trim();
      const signers = parseCommaSeparatedEmails(signersInput);
      const contract = await createContract(token, title, signers);
      const embed = new EmbedBuilder()
        .setTitle('freeeサイン 契約書を作成しました')
        .setColor(0x00c4a7)
        .addFields(
          { name: 'ID', value: contract.id || '-', inline: true },
          { name: 'Title', value: truncate(contract.title, 1024), inline: false },
          { name: 'Signers', value: truncate(signers.join(', '), 1024), inline: false }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'freeeサイン連携の処理中にエラーが発生しました。');

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
