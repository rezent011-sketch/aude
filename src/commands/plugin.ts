import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import PluginRepository from '../db/pluginRepository';
import GuildRepository from '../db/guildRepository';

const MAX_NAME_LEN = 32;
const MAX_TRIGGER_LEN = 64;
const MAX_RESPONSE_LEN = 1500;

function hasAdminPermission(interaction: ChatInputCommandInteraction, adminRoleId: string | null): boolean {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (adminRoleId) {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    return member?.roles.cache.has(adminRoleId) ?? false;
  }
  return false;
}

function applyVariables(text: string, interaction: ChatInputCommandInteraction): string {
  return text
    .replace(/\{\{user\}\}/g, `<@${interaction.user.id}>`)
    .replace(/\{\{username\}\}/g, interaction.user.username)
    .replace(/\{\{server\}\}/g, interaction.guild?.name ?? 'このサーバー')
    .replace(/\{\{channel\}\}/g, `<#${interaction.channelId}>`);
}

export const pluginCommand = {
  data: new SlashCommandBuilder()
    .setName('plugin')
    .setDescription('カスタムコマンド（プラグイン）を管理します')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('登録済みプラグイン一覧を表示します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('新しいプラグインを追加します')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('プラグイン名 (英数字)').setRequired(true).setMaxLength(MAX_NAME_LEN)
        )
        .addStringOption((opt) =>
          opt.setName('trigger').setDescription('トリガーキーワード').setRequired(true).setMaxLength(MAX_TRIGGER_LEN)
        )
        .addStringOption((opt) =>
          opt
            .setName('trigger_type')
            .setDescription('トリガーの種類')
            .setRequired(true)
            .addChoices(
              { name: 'キーワード (メッセージ内に含まれると反応)', value: 'keyword' },
              { name: 'コマンド (手動実行)', value: 'command' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('response').setDescription('応答テキスト').setRequired(true).setMaxLength(MAX_RESPONSE_LEN)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('プラグインを削除します')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('プラグインID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('プラグインの有効/無効を切り替えます')
        .addIntegerOption((opt) =>
          opt.setName('id').setDescription('プラグインID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('use')
        .setDescription('プラグインを手動で実行します')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('プラグイン名').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: '⚠️ このコマンドはサーバー内でのみ使用できます。', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const subcommand = interaction.options.getSubcommand();
      const guildName = interaction.guild?.name ?? '';
      GuildRepository.getOrCreate(guildId, guildName);
      const guildSettings = GuildRepository.getByGuildId(guildId);
      const adminRoleId = guildSettings?.admin_role_id ?? null;

      if (subcommand === 'list') {
        const plugins = PluginRepository.listByGuild(guildId);
        if (!plugins.length) {
          await interaction.editReply('📦 まだプラグインが登録されていません。\n`/plugin add` で追加してください。');
          return;
        }
        const lines = plugins.map((p) =>
          `**[${p.id}]** \`${p.name}\` — ${p.trigger_type === 'keyword' ? '🔑' : '🔧'} \`${p.trigger}\` ${p.is_active ? '✅' : '⏸️'}`
        );
        await interaction.editReply(['📦 **プラグイン一覧**', '', ...lines].join('\n').slice(0, 1900));
        return;
      }

      if (subcommand === 'use') {
        const name = interaction.options.getString('name', true);
        const plugin = PluginRepository.getByName(guildId, name);
        if (!plugin) {
          await interaction.editReply(`⚠️ プラグイン「${name}」が見つかりません。`);
          return;
        }
        if (!plugin.is_active) {
          await interaction.editReply(`⚠️ プラグイン「${name}」は無効化されています。`);
          return;
        }
        const response = applyVariables(plugin.response, interaction);
        await interaction.editReply(response);
        return;
      }

      if (!hasAdminPermission(interaction, adminRoleId)) {
        await interaction.editReply('⚠️ このコマンドを使用するには「サーバーの管理」権限か管理者ロールが必要です。');
        return;
      }

      if (subcommand === 'add') {
        const name = interaction.options.getString('name', true).toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const trigger = interaction.options.getString('trigger', true);
        const triggerType = interaction.options.getString('trigger_type', true) as 'command' | 'keyword';
        const response = interaction.options.getString('response', true);

        const existing = PluginRepository.getByName(guildId, name);
        if (existing) {
          await interaction.editReply(`⚠️ プラグイン「${name}」は既に存在します。`);
          return;
        }

        const plugin = PluginRepository.create(
          guildId, name, trigger, triggerType, response,
          interaction.user.id, interaction.user.username
        );

        await interaction.editReply([
          '✅ プラグインを追加しました。',
          `ID: ${plugin.id}`,
          `名前: \`${plugin.name}\``,
          `トリガー: ${plugin.trigger_type === 'keyword' ? '🔑 キーワード' : '🔧 コマンド'} \`${plugin.trigger}\``,
          `応答: ${plugin.response.slice(0, 100)}${plugin.response.length > 100 ? '...' : ''}`,
        ].join('\n'));
        return;
      }

      if (subcommand === 'remove') {
        const id = interaction.options.getInteger('id', true);
        const plugin = PluginRepository.getById(id, guildId);
        if (!plugin) {
          await interaction.editReply(`⚠️ ID ${id} のプラグインが見つかりません。`);
          return;
        }
        PluginRepository.delete(id, guildId);
        await interaction.editReply(`🗑️ プラグイン「${plugin.name}」(ID: ${id}) を削除しました。`);
        return;
      }

      if (subcommand === 'toggle') {
        const id = interaction.options.getInteger('id', true);
        const plugin = PluginRepository.getById(id, guildId);
        if (!plugin) {
          await interaction.editReply(`⚠️ ID ${id} のプラグインが見つかりません。`);
          return;
        }
        const newState = !plugin.is_active;
        PluginRepository.toggle(id, guildId, newState);
        await interaction.editReply(`${newState ? '✅ 有効化' : '⏸️ 無効化'}しました: \`${plugin.name}\` (ID: ${id})`);
        return;
      }

      await interaction.editReply('⚠️ 不明なサブコマンドです。');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await interaction.editReply(`⚠️ エラーが発生しました: ${msg}`);
    }
  },
};
