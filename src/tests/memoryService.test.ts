// src/tests/memoryService.test.ts
// Week13: AIメモリシステム テスト

import MemoryRepository from '../db/memoryRepository';
import {
  addMemory,
  buildMemoryContext,
  clearMemories,
  deleteMemory,
  formatMemoryList,
} from '../services/memoryService';

jest.mock('../db/memoryRepository');

const MockMemoryRepository = MemoryRepository as jest.Mocked<typeof MemoryRepository>;

const DISCORD_ID = 'test-user-123';

describe('memoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildMemoryContext', () => {
    it('returns empty string when no memories', () => {
      MockMemoryRepository.findTopByDiscordId.mockReturnValue([]);
      expect(buildMemoryContext(DISCORD_ID)).toBe('');
    });

    it('formats memories as context string', () => {
      MockMemoryRepository.findTopByDiscordId.mockReturnValue([
        {
          id: 1,
          discord_id: DISCORD_ID,
          memory_type: 'preference',
          content: 'TypeScriptが好き',
          source: 'manual',
          importance: 3,
          created_at: '2026-05-20',
          updated_at: '2026-05-20',
        },
      ]);
      const ctx = buildMemoryContext(DISCORD_ID);
      expect(ctx).toContain('User Memory');
      expect(ctx).toContain('TypeScriptが好き');
      expect(ctx).toContain('preference');
    });
  });

  describe('addMemory', () => {
    it('creates a memory with manual source', () => {
      const mockMemory = {
        id: 42,
        discord_id: DISCORD_ID,
        memory_type: 'skill' as const,
        content: 'Reactが得意',
        source: 'manual' as const,
        importance: 3,
        created_at: '2026-05-20',
        updated_at: '2026-05-20',
      };
      MockMemoryRepository.create.mockReturnValue(mockMemory);

      const result = addMemory({
        discord_id: DISCORD_ID,
        memory_type: 'skill',
        content: 'Reactが得意',
      });

      expect(MockMemoryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discord_id: DISCORD_ID,
          memory_type: 'skill',
          content: 'Reactが得意',
          source: 'manual',
        })
      );
      expect(result.id).toBe(42);
    });
  });

  describe('deleteMemory', () => {
    it('returns true when deletion succeeds', () => {
      MockMemoryRepository.deleteById.mockReturnValue(true);
      expect(deleteMemory(1, DISCORD_ID)).toBe(true);
    });

    it('returns false when memory not found', () => {
      MockMemoryRepository.deleteById.mockReturnValue(false);
      expect(deleteMemory(999, DISCORD_ID)).toBe(false);
    });
  });

  describe('clearMemories', () => {
    it('deletes all memories and returns count', () => {
      MockMemoryRepository.deleteAllByDiscordId.mockReturnValue(5);
      expect(clearMemories(DISCORD_ID)).toBe(5);
    });
  });

  describe('formatMemoryList', () => {
    it('returns empty message when no memories', () => {
      MockMemoryRepository.findByDiscordId.mockReturnValue([]);
      const result = formatMemoryList(DISCORD_ID);
      expect(result).toContain('メモリはありません');
    });

    it('groups memories by type', () => {
      MockMemoryRepository.findByDiscordId.mockReturnValue([
        {
          id: 1,
          discord_id: DISCORD_ID,
          memory_type: 'preference',
          content: '日本語で回答',
          source: 'manual',
          importance: 3,
          created_at: '2026-05-20',
          updated_at: '2026-05-20',
        },
        {
          id: 2,
          discord_id: DISCORD_ID,
          memory_type: 'skill',
          content: 'TypeScriptエンジニア',
          source: 'auto',
          importance: 4,
          created_at: '2026-05-20',
          updated_at: '2026-05-20',
        },
      ]);

      const result = formatMemoryList(DISCORD_ID);
      expect(result).toContain('好み・設定');
      expect(result).toContain('スキル');
      expect(result).toContain('日本語で回答');
      expect(result).toContain('TypeScriptエンジニア');
    });
  });
});
