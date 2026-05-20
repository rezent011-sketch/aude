import TeamMemoryRepository, {
  CreateTeamMemoryParams,
  TeamMemory,
  TeamMemoryType,
} from '../db/teamMemoryRepository';

export const TEAM_MEMORY_TYPE_LABELS: Record<TeamMemoryType, string> = {
  fact: '📌 共有情報',
  rule: '📏 ルール',
  context: '💬 コンテキスト',
  goal: '🎯 ゴール',
};

export function buildTeamMemoryContext(guildId: string | null): string {
  if (!guildId) {
    return '';
  }

  const memories = TeamMemoryRepository.findTopByGuildId(guildId, 10);
  if (memories.length === 0) return '';

  const lines = memories.map((memory) => `- [${memory.memory_type}] ${memory.content}`);
  return `\n\n## Server Shared Memory\n${lines.join('\n')}`;
}

export function extractAndSaveTeamMemory(
  guildId: string | null,
  addedBy: string,
  message: string
): void {
  if (!guildId) {
    return;
  }

  const text = message.trim();
  if (!text || text.length < 10) {
    return;
  }

  const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();
  const findDuplicate = (content: string): boolean =>
    TeamMemoryRepository.findByGuildId(guildId).some(
      (memory) => normalize(memory.content) === normalize(content)
    );

  const tryAdd = (memoryType: TeamMemoryType, content: string, importance: number) => {
    const normalizedContent = normalize(content).slice(0, 200);
    if (normalizedContent.length <= 5 || findDuplicate(normalizedContent)) {
      return;
    }

    TeamMemoryRepository.create({
      guild_id: guildId,
      added_by: addedBy,
      memory_type: memoryType,
      content: normalizedContent,
      importance,
    });
  };

  const patterns: Array<{ type: TeamMemoryType; importance: number; matches: RegExp[] }> = [
    {
      type: 'rule',
      importance: 5,
      matches: [
        /(?:server|guild|team|このサーバー|このチーム).{0,20}(?:rule|ルール|禁止|must|always|never)/i,
        /(?:no|don't|do not|禁止|避けて|しないで).{0,80}/i,
      ],
    },
    {
      type: 'fact',
      importance: 4,
      matches: [
        /(?:we are|our team is|this server is|私たちは|うちのチームは|このサーバーは).{0,100}/i,
        /(?:project|プロジェクト)名は.{0,80}/i,
      ],
    },
    {
      type: 'goal',
      importance: 4,
      matches: [
        /(?:goal|objective|target|目標|目的|目指している).{0,100}/i,
        /(?:we want to|we need to|チームで|みんなで).{0,100}(?:作る|達成|改善|移行|launch|ship|build)/i,
      ],
    },
    {
      type: 'context',
      importance: 3,
      matches: [
        /(?:currently|right now|at the moment|現在|今は|進行中|作業中).{0,100}/i,
        /(?:using|stack|環境|構成|運用).{0,100}/i,
      ],
    },
  ];

  for (const group of patterns) {
    for (const pattern of group.matches) {
      if (pattern.test(text)) {
        tryAdd(group.type, text, group.importance);
        return;
      }
    }
  }
}

export function addTeamMemory(
  params: CreateTeamMemoryParams
): TeamMemory {
  return TeamMemoryRepository.create({
    ...params,
    importance: params.importance ?? 5,
  });
}

export function formatTeamMemoryList(guildId: string): string {
  const memories = TeamMemoryRepository.findByGuildId(guildId);

  if (memories.length === 0) {
    return '📭 このサーバーの共有メモリはありません。';
  }

  const grouped: Record<TeamMemoryType, TeamMemory[]> = {
    fact: [],
    rule: [],
    context: [],
    goal: [],
  };

  for (const memory of memories) {
    grouped[memory.memory_type].push(memory);
  }

  const lines: string[] = [`🧠 **サーバー共有メモリ** (${memories.length}件)\n`];

  for (const [type, items] of Object.entries(grouped) as [TeamMemoryType, TeamMemory[]][]) {
    if (items.length === 0) {
      continue;
    }

    lines.push(`**${TEAM_MEMORY_TYPE_LABELS[type]}**`);
    for (const item of items) {
      lines.push(`  \`[${item.id}]\` ${item.content}`);
    }
    lines.push('');
  }

  lines.push('_`/tmemory delete <id>` で個別削除、`/tmemory clear` で全削除_');
  return lines.join('\n');
}

export function searchTeamMemories(guildId: string, query: string): TeamMemory[] {
  return TeamMemoryRepository.search(guildId, query.trim());
}

export function deleteTeamMemory(id: number, guildId: string): boolean {
  return TeamMemoryRepository.deleteById(id, guildId);
}

export function clearTeamMemories(guildId: string): number {
  return TeamMemoryRepository.clear(guildId);
}
