import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { TeamMemoryType } from '../db/teamMemoryRepository';
import {
  TEAM_MEMORY_TYPE_LABELS,
  addTeamMemory,
  clearTeamMemories,
  deleteTeamMemory,
  formatTeamMemoryList,
  searchTeamMemories,
} from '../services/teamMemoryService';

function buildInfoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description.slice(0, 4000))
    .setTimestamp();
}

export const tmemoryCommand = {
  data: new SlashCommandBuilder()
    .setName('tmemory')
    .setDescription('サーバー共有メモリを管理します')
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('このサーバーの共有メモリを一覧表示します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('共有メモリを追加します')
        .addStringOption((opt) =>
          opt
            .setName('content')
            .setDescription('記憶させたい内容')
            .setRequired(true)
            .setMaxLength(200)
        )
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('メモリの種類')
            .setRequired(false)
            .addChoices(
              { name: '📌 共有情報', value: 'fact' },
              { name: '📏 ルール', value: 'rule' },
              { name: '💬 コンテキスト', value: 'context' },
              { name: '🎯 ゴール', value: 'goal' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('指定したIDの共有メモリを削除します')
        .addIntegerOption((opt) =>
          opt
            .setName('id')
            .setDescription('削除するメモリID')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('このサーバーの共有メモリを全削除します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('共有メモリを検索します')
        .addStringOption((opt) =>
          opt
            .setName('query')
            .setDescription('検索キーワード')
            .setRequired(true)
            .setMaxLength(100)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        embeds: [buildInfoEmbed('Server Only', '⚠️ `/tmemory` はサーバー内でのみ使用できます。')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      await interaction.editReply({
        embeds: [buildInfoEmbed('Server Shared Memory', formatTeamMemoryList(guildId))],
      });
      return;
    }

    if (subcommand === 'add') {
      const content = interaction.options.getString('content', true);
      const type = (interaction.options.getString('type') ?? 'fact') as TeamMemoryType;
      const memory = addTeamMemory({
        guild_id: guildId,
        added_by: interaction.user.id,
        memory_type: type,
        content,
      });

      await interaction.editReply({
        embeds: [
          buildInfoEmbed(
            'Team Memory Saved',
            `✅ \`[${memory.id}]\` ${TEAM_MEMORY_TYPE_LABELS[memory.memory_type]} ${memory.content}`
          ),
        ],
      });
      return;
    }

    if (subcommand === 'delete') {
      const id = interaction.options.getInteger('id', true);
      const success = deleteTeamMemory(id, guildId);

      await interaction.editReply({
        embeds: [
          buildInfoEmbed(
            success ? 'Team Memory Deleted' : 'Not Found',
            success
              ? `🗑️ 共有メモリ \`[${id}]\` を削除しました。`
              : `❌ 共有メモリ \`[${id}]\` が見つかりません。\`/tmemory list\` で確認してください。`
          ),
        ],
      });
      return;
    }

    if (subcommand === 'clear') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply({
          embeds: [
            buildInfoEmbed(
              'Permission Required',
              '⚠️ `/tmemory clear` には「サーバーの管理」権限が必要です。'
            ),
          ],
        });
        return;
      }

      const count = clearTeamMemories(guildId);
      await interaction.editReply({
        embeds: [
          buildInfoEmbed('Team Memory Cleared', `🗑️ ${count}件の共有メモリを削除しました。`),
        ],
      });
      return;
    }

    if (subcommand === 'search') {
      const query = interaction.options.getString('query', true);
      const memories = searchTeamMemories(guildId, query);

      if (memories.length === 0) {
        await interaction.editReply({
          embeds: [
            buildInfoEmbed('Search Results', `🔎 「${query}」に一致する共有メモリはありません。`),
          ],
        });
        return;
      }

      const lines = memories.map(
        (memory) =>
          `\`[${memory.id}]\` ${TEAM_MEMORY_TYPE_LABELS[memory.memory_type]} ${memory.content}`
      );

      await interaction.editReply({
        embeds: [
          buildInfoEmbed(
            'Search Results',
            [`🔎 「${query}」の検索結果 (${memories.length}件)`, '', ...lines].join('\n')
          ),
        ],
      });
      return;
    }
  },
};
