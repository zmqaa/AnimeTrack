import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildPortableExport } = require('../../scripts/shared/portable_export') as {
  buildPortableExport: (
    anime: Array<Record<string, unknown>>,
    history: Array<Record<string, unknown>>,
    exportedAt?: string,
    manga?: Array<Record<string, unknown>>,
  ) => Record<string, unknown>;
};

describe('portable JSON export', () => {
  it('exports overall and episode notes as one structured collection', () => {
    const result = buildPortableExport([{
      id: 1,
      title: '备注测试',
      status: 'watching',
      progress: 3,
      tags: ['TV', '漫画改', '2026', '2026年7月', '日常'],
      startDate: '2026-07-20',
      startDateSource: 'history',
      notes: '兼容字段不应覆盖结构化备注',
      noteEntries: [
        {
          id: 10,
          animeId: 1,
          content: '总备注',
          notedAt: '2026-07-20',
        },
        {
          id: 11,
          animeId: 1,
          episode: 3,
          content: '第三集随记',
          notedAt: '2026-07-21',
        },
      ],
    }], [], '2026-07-26T00:00:00.000Z') as {
      formatVersion: number;
      anime: { records: Array<Record<string, unknown>> };
    };

    expect(result.formatVersion).toBe(4);
    expect(result.anime.records[0].notes).toEqual([
      { id: 10, content: '总备注', notedAt: '2026-07-20' },
      { id: 11, episode: 3, content: '第三集随记', notedAt: '2026-07-21' },
    ]);
    expect(result.anime.records[0]).not.toHaveProperty('noteEntries');
    expect(result.anime.records[0]).toMatchObject({
      startDate: '2026-07-20',
      startDateSource: 'history',
      tags: ['TV', '漫画改', '2026', '2026年7月', '日常'],
    });
  });

  it('exports manga records without inventing reading history', () => {
    const result = buildPortableExport([], [], '2026-08-03T00:00:00.000Z', [{
      id: 1,
      title: '大室家',
      status: 'caught_up',
      publicationStatus: 'ongoing',
      currentChapter: '87.5',
      authors: ['なもり'],
    }]) as {
      manga: { count: number; records: Array<Record<string, unknown>> };
      watchHistory: { count: number };
    };

    expect(result.manga.count).toBe(1);
    expect(result.manga.records[0]).toMatchObject({
      title: '大室家',
      currentChapter: '87.5',
    });
    expect(result.watchHistory.count).toBe(0);
  });
});
