import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import GuildRepository, { GuildModelChoice } from '../db/guildRepository';
import { getModelLabel } from '../llm/router';

function formatSettings(settings: ReturnType<typeof GuildRepository.getByGuildId>) {
  if (!settings) return '設定が見つかりません。';

  const modelLabel =
    settings.default_model === 'auto'
      ? 'Auto (自動選択)'
      : getModelLabel(settings.default_model as Exclude<GuildModelChoice, 'auto'>);

  return [
    `**サーバー設定** — ${settings.guild_name}`,
    `デフォルトモデル: ${modelLabel}`,
    `プレフィックス: \`${settings.prefix}\``,
    `管理者ロール: ${settings.admin_role_id ? `<@&${settings.admin_role_id}>` : '未設定'}`,
    `最大クレジット/ユーザー: ${settings.max_credits_per_user}`,
    `最終更新: ${settings.updated_at}`,
  ].join('\n');
}

function hasAdminPermission(
  interaction: ChatInputCommandInteraction,
  adminRoleId: string | null
): boolean {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  if (adminRoleId) {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    return member?.roles.cache.has(adminRoleId) ?? false;
  }
  return false;
}

export const configCommand = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('このサーバーの Aude 設定を管理します')
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('現在の設定を表示します')
    )
    .addSubcommandGroup((group) =>
      group
        .setName('set')
        .setDescription('設定を変更します')
        .addSubcommand((sub) =>
          sub
            .setName('model')
            .setDescription('デフォルト AI モデルを設定します')
            .addStringOption((opt) =>
              opt
                .setName('value')
                .setDescription('使用するモデル')
                .setRequired(true)
                .addChoices(
                  { name: 'Auto (自動)', value: 'auto' },
                  { name: 'Claude', value: 'claude' },
                  { name: 'GPT-4o', value: 'gpt4o' }
                )
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('prefix')
            .setDescription('コマンドプレフィックスを設定します')
            .addStringOption((opt) =>
              opt
                .setName('value')
                .setDescription('新しいプレフィックス (例: !, /, ?)')
                .setRequired(true)
                .setMaxLength(5)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('admin_role')
            .setDescription('Aude 設定を変更できるロールを指定します')
            .addRoleOption((opt) =>
              opt.setName('role').setDescription('管理者ロール').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('max_credits')
            .setDescription('ユーザーごとの最大クレジット数を設定します')
            .addIntegerOption((opt) =>
              opt
                .setName('value')
                .setDescription('最大クレジット数 (1〜10000)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10000)
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('reset').setDescription('設定をデフォルトにリセットします')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        content: '⚠️ このコマンドはサーバー内でのみ使用できます。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const guildName = interaction.guild?.name ?? '';
      const settings = GuildRepository.getOrCreate(guildId, guildName);

      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();

      // view は誰でも使える
      if (!subcommandGroup && subcommand === 'view') {
        await interaction.editReply(formatSettings(settings));
        return;
      }

      // set / reset は権限チェック
      if (!hasAdminPermission(interaction, settings.admin_role_id)) {
        await interaction.editReply(
          '⚠️ このコマンドを使用するには「サーバーの管理」権限か管理者ロールが必要です。'
        );
        return;
      }

      if (!subcommandGroup && subcommand === 'reset') {
        const updated = GuildRepository.resetToDefaults(guildId);
        await interaction.editReply(
          ['✅ 設定をデフォルトにリセットしました。', '', formatSettings(updated)].join('\n')
        );
        return;
      }

      // set サブコマンドグループ
      if (subcommandGroup === 'set') {
        let updated: ReturnType<typeof GuildRepository.getByGuildId>;

        if (subcommand === 'model') {
          const value = interaction.options.getString('value', true) as GuildModelChoice;
          updated = GuildRepository.updateSetting(guildId, 'default_model', value);
          await interaction.editReply(
            [`✅ デフォルトモデルを更新しました。`, '', formatSettings(updated)].join('\n')
          );
          return;
        }

        if (subcommand === 'prefix') {
          const value = interaction.options.getString('value', true);
          updated = GuildRepository.updateSetting(guildId, 'prefix', value);
          await interaction.editReply(
            [`✅ プレフィックスを \`${value}\` に変更しました。`, '', formatSettings(updated)].join('\n')
          );
          return;
        }

        if (subcommand === 'admin_role') {
          const role = interaction.options.getRole('role', true);
          updated = GuildRepository.updateSetting(guildId, 'admin_role_id', role.id);
          await interaction.editReply(
            [`✅ 管理者ロールを <@&${role.id}> に設定しました。`, '', formatSettings(updated)].join('\n')
          );
          return;
        }

        if (subcommand === 'max_credits') {
          const value = interaction.options.getInteger('value', true);
          updated = GuildRepository.updateSetting(guildId, 'max_credits_per_user', value);
          await interaction.editReply(
            [`✅ 最大クレジット数を ${value} に変更しました。`, '', formatSettings(updated)].join('\n')
          );
          return;
        }
      }

      await interaction.editReply('⚠️ 不明なサブコマンドです。');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`⚠️ エラーが発生しました: ${msg}`);
      } else {
        await interaction.reply({ content: `⚠️ エラーが発生しました: ${msg}`, flags: MessageFlags.Ephemeral });
      }
    }
  },
};
