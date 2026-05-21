import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getErrorMessage } from '../integrations/errors';
import { listBuckets, listObjects } from '../integrations/awss3';
import vaultService from '../services/vaultService';
import { truncate } from '../utils/discord';

const DEFAULT_REGION = 'ap-northeast-1';

function buildCredentialGuideEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('AWS認証情報が未設定です')
    .setDescription(
      '/vault set で aws_access_key_id と aws_secret_access_key を設定してください'
    )
    .setColor(0xff9900);
}

function buildListDescription(lines: string[]): string {
  return truncate(lines.join('\n\n'), 4000);
}

export const awss3Command = {
  data: new SlashCommandBuilder()
    .setName('awss3')
    .setDescription('AWS S3のバケット・オブジェクトを確認します')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('buckets')
        .setDescription('バケット一覧を表示します')
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription(`AWS region。省略時は ${DEFAULT_REGION}`)
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('objects')
        .setDescription('バケット内オブジェクト一覧を表示します')
        .addStringOption((option) =>
          option.setName('bucket').setDescription('S3 bucket name').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('prefix').setDescription('オブジェクトのprefix').setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription(`AWS region。省略時は ${DEFAULT_REGION}`)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const accessKeyId = vaultService.getCredential(
        interaction.user.id,
        'user',
        'aws_access_key_id'
      );
      const secretKey = vaultService.getCredential(
        interaction.user.id,
        'user',
        'aws_secret_access_key'
      );

      if (!accessKeyId || !secretKey) {
        await interaction.reply({
          embeds: [buildCredentialGuideEmbed()],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (subcommand === 'buckets') {
        const region = interaction.options.getString('region')?.trim() || DEFAULT_REGION;
        const buckets = await listBuckets(accessKeyId, secretKey, region);
        const embed = new EmbedBuilder().setTitle('AWS S3 Buckets').setColor(0xff9900);

        if (buckets.length === 0) {
          embed.setDescription('バケットは見つかりませんでした。');
        } else {
          embed.setDescription(
            buildListDescription(
              buckets.map(
                (bucket) =>
                  `**${bucket.name || '(No name)'}**\nCreated: ${bucket.creationDate || '-'}`
              )
            )
          );
        }

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const bucket = interaction.options.getString('bucket', true).trim();
      const prefix = interaction.options.getString('prefix')?.trim();
      const region = interaction.options.getString('region')?.trim() || DEFAULT_REGION;
      const objects = await listObjects(accessKeyId, secretKey, region, bucket, prefix);
      const embed = new EmbedBuilder()
        .setTitle(`AWS S3 Objects: ${bucket}`)
        .setColor(0xff9900)
        .addFields(
          { name: 'Region', value: region, inline: true },
          { name: 'Prefix', value: prefix || '-', inline: true }
        );

      if (objects.length === 0) {
        embed.setDescription('オブジェクトは見つかりませんでした。');
      } else {
        embed.setDescription(
          buildListDescription(
            objects.map(
              (object) =>
                `**${object.key || '(No key)'}**\nSize: ${object.size} bytes\nLast Modified: ${object.lastModified || '-'}`
            )
          )
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = getErrorMessage(error, 'AWS S3連携の処理中にエラーが発生しました。');

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
