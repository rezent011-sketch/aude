// src/services/memoryService.ts
// Week13: AIメモリシステム - メモリ管理サービス

import MemoryRepository, { CreateMemoryParams, MemoryType, UserMemory } from '../db/memoryRepository';

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  preference: '⚙️ 好み・設定',
  fact: '📌 事実・情報',
  skill: '🛠️ スキル・得意分野',
  context: '💬 コンテキスト',
};

/**
 * ユーザーのメモリをAIシステムプロンプト用の文字列に変換
 */
export function buildMemoryContext(discordId: string): string {
  const memories = MemoryRepository.findTopByDiscordId(discordId, 10);
  if (memories.length === 0) return '';

  const lines = memories.map((m) => `- [${m.memory_type}] ${m.content}`);
  return `\n\n## User Memory (${discordId})\n${lines.join('\n')}`;
}

/**
 * 会話内容からメモリを自動抽出（簡易ルールベース）
 * LLMを使わずに確実に動作させるためルールベースで実装
 */
export function extractMemoriesFromConversation(
  discordId: string,
  userMessage: string
): void {
  const text = userMessage.trim();
  if (!text || text.length < 10) return;

  // 好み・設定を表すパターン
  const preferencePatterns = [
    /私は(いつも|常に|必ず)([\w\s]+)を使/,
    /好きな(言語|ツール|フレームワーク)は([\w\s]+)/,
    /(TypeScript|Python|Go|Rust|Java|Ruby)が?(得意|好き|メイン)/,
    /(日本語|英語)で?(返答|回答|応答)/,
  ];

  // スキルを表すパターン
  const skillPatterns = [
    /([\w\s]+)エンジニア(です|として|で働)/,
    /(フロントエンド|バックエンド|フルスタック|インフラ)/,
    /([\d]+)年の(開発|プログラミング|エンジニア)経験/,
  ];

  // 事実を表すパターン
  const factPatterns = [
    /プロジェクト名は([\w\s]+)/,
    /会社名は([\w\s]+)/,
    /チームは([\d]+)人/,
  ];

  const tryAdd = (type: MemoryType, content: string, importance: number) => {
    if (content.length > 5 && !MemoryRepository.existsSimilar(discordId, content)) {
      MemoryRepository.create({ discord_id: discordId, memory_type: type, content, source: 'auto', importance });
    }
  };

  for (const pattern of preferencePatterns) {
    const match = text.match(pattern);
    if (match) tryAdd('preference', text.slice(0, 100), 3);
  }

  for (const pattern of skillPatterns) {
    const match = text.match(pattern);
    if (match) tryAdd('skill', text.slice(0, 100), 4);
  }

  for (const pattern of factPatterns) {
    const match = text.match(pattern);
    if (match) tryAdd('fact', text.slice(0, 100), 3);
  }
}

/**
 * 手動でメモリを追加
 */
export function addMemory(params: CreateMemoryParams): UserMemory {
  return MemoryRepository.create({ ...params, source: 'manual', importance: params.importance ?? 3 });
}

/**
 * ユーザーのメモリ一覧を整形して返す
 */
export function formatMemoryList(discordId: string): string {
  const memories = MemoryRepository.findByDiscordId(discordId);

  if (memories.length === 0) {
    return '📭 保存されているメモリはありません。';
  }

  const grouped: Record<MemoryType, UserMemory[]> = {
    preference: [],
    fact: [],
    skill: [],
    context: [],
  };

  for (const m of memories) {
    grouped[m.memory_type].push(m);
  }

  const lines: string[] = [`🧠 **あなたのAIメモリ** (${memories.length}件)\n`];

  for (const [type, items] of Object.entries(grouped) as [MemoryType, UserMemory[]][]) {
    if (items.length === 0) continue;
    lines.push(`**${MEMORY_TYPE_LABELS[type]}**`);
    for (const item of items) {
      const src = item.source === 'manual' ? '✏️' : '🤖';
      lines.push(`  ${src} \`[${item.id}]\` ${item.content}`);
    }
    lines.push('');
  }

  lines.push('_`/memory delete <id>` で個別削除、`/memory clear` で全削除_');
  return lines.join('\n');
}

/**
 * メモリを削除
 */
export function deleteMemory(id: number, discordId: string): boolean {
  return MemoryRepository.deleteById(id, discordId);
}

/**
 * 全メモリをクリア
 */
export function clearMemories(discordId: string): number {
  return MemoryRepository.deleteAllByDiscordId(discordId);
}
