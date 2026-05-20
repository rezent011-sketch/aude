import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import {
  addMemory,
  clearMemories,
  deleteMemory,
  formatMemoryList,
} from '../services/memoryService';
import { MemoryType } from '../db/memoryRepository';

export const memoryCommand = {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('Aude があなたについて覚えていることを管理します')
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('保存されているメモリを一覧表示します')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('新しいメモリを手動で追加します')
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
              { name: '⚙️ 好み・設定', value: 'preference' },
              { name: '📌 事実・情報', value: 'fact' },
              { name: '🛠️ スキル・得意分野', value: 'skill' },
              { name: '💬 コンテキスト', value: 'context' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('指定したIDのメモリを削除します')
        .addIntegerOption((opt) =>
          opt
            .setName('id')
            .setDescription('削除するメモリのID (`/memory list` で確認)')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('全てのメモリを削除します（取り消し不可）')
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const discordId = interaction.user.id;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (subcommand === 'list') {
      const result = formatMemoryList(discordId);
      await interaction.editReply({ content: result });
      return;
    }

    if (subcommand === 'add') {
      const content = interaction.options.getString('content', true);
      const type = (interaction.options.getString('type') ?? 'context') as MemoryType;

      const memory = addMemory({ discord_id: discordId, memory_type: type, content });
      await interaction.editReply({
        content: `✅ メモリを保存しました！\n> \`[${memory.id}]\` ${memory.content}`,
      });
      return;
    }

    if (subcommand === 'delete') {
      const id = interaction.options.getInteger('id', true);
      const success = deleteMemory(id, discordId);

      if (success) {
        await interaction.editReply({ content: `🗑️ メモリ \`[${id}]\` を削除しました。` });
      } else {
        await interaction.editReply({
          content: `❌ メモリ \`[${id}]\` が見つかりません。\`/memory list\` でIDを確認してください。`,
        });
      }
      return;
    }

    if (subcommand === 'clear') {
      const count = clearMemories(discordId);
      await interaction.editReply({
        content: `🗑️ ${count}件のメモリを全て削除しました。`,
      });
      return;
    }
  },
};
