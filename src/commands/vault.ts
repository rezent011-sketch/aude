import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandStringOption,
} from 'discord.js';
import vaultService, { VaultOwnerType } from '../services/vaultService';

type VaultTarget = {
  ownerId: string;
  ownerType: VaultOwnerType;
  label: string;
};

const MAX_VALUE_LENGTH = 1800;

function addVaultTypeOption(option: SlashCommandStringOption): SlashCommandStringOption {
  return option.setName('type').setDescription('保存先').addChoices(
    { name: '個人', value: 'user' },
    { name: 'サーバー', value: 'guild' }
  );
}

function resolveVaultTarget(interaction: ChatInputCommandInteraction): VaultTarget {
  const requestedType = (interaction.options.getString('type') ?? 'user') as VaultOwnerType;

  if (requestedType === 'guild') {
    if (!interaction.guildId) {
      throw new Error('サーバー保管庫はサーバー内でのみ使用できます。');
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      throw new Error('サーバー保管庫を使うには「サーバーの管理」権限が必要です。');
    }

    return {
      ownerId: interaction.guildId,
      ownerType: 'guild',
      label: `サーバー保管庫 (${interaction.guild?.name ?? interaction.guildId})`,
    };
  }

  return {
    ownerId: interaction.user.id,
    ownerType: 'user',
    label: '個人保管庫',
  };
}

function chunkText(value: string, maxLength: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }
  return chunks.length > 0 ? chunks : [''];
}

export const vaultCommand = {
  data: new SlashCommandBuilder()
    .setName('vault')
    .setDescription('APIキーなどの機密情報を安全に保管します')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('機密情報を保存します')
        .addStringOption((opt) =>
          opt.setName('key').setDescription('資格情報のキー名').setRequired(true).setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName('value')
            .setDescription('保存する値')
            .setRequired(true)
            .setMaxLength(MAX_VALUE_LENGTH)
        )
        .addStringOption((opt) => addVaultTypeOption(opt))
    )
    .addSubcommand((sub) =>
      sub
        .setName('get')
        .setDescription('保存済みの機密情報を取得します')
        .addStringOption((opt) =>
          opt.setName('key').setDescription('取得するキー名').setRequired(true).setMaxLength(100)
        )
        .addStringOption((opt) => addVaultTypeOption(opt))
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('保存済みキー名を一覧表示します')
        .addStringOption((opt) => addVaultTypeOption(opt))
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('保存済みの機密情報を削除します')
        .addStringOption((opt) =>
          opt.setName('key').setDescription('削除するキー名').setRequired(true).setMaxLength(100)
        )
        .addStringOption((opt) => addVaultTypeOption(opt))
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const subcommand = interaction.options.getSubcommand();
      const target = resolveVaultTarget(interaction);

      if (subcommand === 'set') {
        const key = interaction.options.getString('key', true);
        const value = interaction.options.getString('value', true);

        vaultService.setCredential(target.ownerId, target.ownerType, key, value);
        await interaction.editReply(`✅ \`${key}\` を${target.label}に保存しました。`);
        return;
      }

      if (subcommand === 'get') {
        const key = interaction.options.getString('key', true);
        const value = vaultService.getCredential(target.ownerId, target.ownerType, key);

        if (value === null) {
          await interaction.editReply(`⚠️ ${target.label}に \`${key}\` は保存されていません。`);
          return;
        }

        const chunks = chunkText(value, 1800);
        for (let index = 0; index < chunks.length; index += 1) {
          const content = [
            `🔐 ${target.label}の \`${key}\` (${index + 1} / ${chunks.length})`,
            '```text',
            chunks[index],
            '```',
          ].join('\n');

          if (index === 0) {
            await interaction.editReply(content);
          } else {
            await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
          }
        }
        return;
      }

      if (subcommand === 'list') {
        const keys = vaultService.listCredentials(target.ownerId, target.ownerType);

        if (keys.length === 0) {
          await interaction.editReply(`📭 ${target.label}に保存されているキーはありません。`);
          return;
        }

        await interaction.editReply([
          `🗂️ ${target.label}の保存済みキー (${keys.length}件)`,
          ...keys.map((key) => `- \`${key}\``),
        ].join('\n'));
        return;
      }

      if (subcommand === 'delete') {
        const key = interaction.options.getString('key', true);
        const deleted = vaultService.deleteCredential(target.ownerId, target.ownerType, key);

        if (!deleted) {
          await interaction.editReply(`⚠️ ${target.label}に \`${key}\` は保存されていません。`);
          return;
        }

        await interaction.editReply(`🗑️ ${target.label}から \`${key}\` を削除しました。`);
        return;
      }

      await interaction.editReply('⚠️ 不明なサブコマンドです。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await interaction.editReply(`⚠️ エラーが発生しました: ${message}`);
    }
  },
};
