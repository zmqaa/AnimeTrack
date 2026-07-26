import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let temporaryDirectory: string;
let importModule: typeof import('../../lib/anime-import');
let dbModule: typeof import('../../lib/db');

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'animetrack-import-test-'));
  process.env.DB_PATH = join(temporaryDirectory, 'animetrack.db');
  process.env.ANIMETRACK_BACKUPS_DIR = join(temporaryDirectory, 'backups');
  process.env.ANIMETRACK_COVERS_DIR = join(temporaryDirectory, 'covers');

  importModule = await import('../../lib/anime-import');
  dbModule = await import('../../lib/db');
  dbModule.getRawDb();
});

beforeEach(() => {
  dbModule.getRawDb().exec(`
    DROP TRIGGER IF EXISTS reject_imported_anime;
    DELETE FROM watch_history;
    DELETE FROM anime;
  `);
});

afterAll(() => {
  dbModule?.closeDb();
  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  delete process.env.DB_PATH;
  delete process.env.ANIMETRACK_BACKUPS_DIR;
  delete process.env.ANIMETRACK_COVERS_DIR;
});

function seedExistingAnime(title = '原有番剧') {
  const db = dbModule.getRawDb();
  const result = db.prepare(`
    INSERT INTO anime (title, status, progress, tags, cast, cast_aliases)
    VALUES (?, 'watching', 1, '[]', '[]', '[]')
  `).run(title);
  return Number(result.lastInsertRowid);
}

function listAnimeRows() {
  return dbModule.getRawDb().prepare(`
    SELECT id, title, coverUrl, localCoverUrl, status, progress
    FROM anime
    ORDER BY id ASC
  `).all() as Array<{
    id: number;
    title: string;
    coverUrl: string | null;
    localCoverUrl: string | null;
    status: string;
    progress: number;
  }>;
}

describe('portable data replacement import', () => {
  it('imports overall and episode notes from the structured JSON format', async () => {
    await importModule.importAnimeData({
      anime: {
        records: [{
          id: 9,
          title: '备注测试',
          status: 'watching',
          progress: 3,
          notes: [
            {
              content: '总体感觉不错\n会继续看',
              notedAt: '2026-07-20',
            },
            {
              episode: 3,
              content: '这一集很有意思',
              notedAt: '2026-07-21',
            },
          ],
        }],
      },
    });

    const anime = dbModule.getRawDb().prepare(`
      SELECT id, notes FROM anime WHERE title = '备注测试'
    `).get() as { id: number; notes: string };
    expect(anime.notes).toBe('总体感觉不错\n会继续看');
    expect(dbModule.getRawDb().prepare(`
      SELECT episode, content, notedAt
      FROM anime_notes
      WHERE animeId = ?
      ORDER BY episode IS NULL DESC, episode ASC
    `).all(anime.id)).toEqual([
      { episode: null, content: '总体感觉不错\n会继续看', notedAt: expect.any(String) },
      { episode: 3, content: '这一集很有意思', notedAt: '2026-07-21' },
    ]);
  });

  it('replaces anime and maps history through numeric and legacy source IDs', async () => {
    seedExistingAnime();

    const result = await importModule.importAnimeData({
      anime: {
        records: [
          {
            id: 7,
            title: '作品 A',
            status: 'watching',
            progress: 2,
            coverUrl: 'https://lain.bgm.tv/pic/cover/l/example.jpg',
            localCoverUrl: '/api/local-covers/7.jpg',
          },
          {
            id: 'legacy-b',
            title: '作品 B',
            status: 'completed',
            progress: 12,
          },
        ],
      },
      watchHistory: {
        records: [
          { animeId: 7, episode: 1, watchedAt: '2026-07-20T12:00:00.000Z' },
          { animeId: 'legacy-b', episode: 12, watchedAt: '2026-07-21T12:00:00.000Z' },
          { animeId: 'missing', episode: 1, watchedAt: '2026-07-22T12:00:00.000Z' },
        ],
      },
    });

    expect(result).toEqual({
      success: true,
      mode: 'replace',
      anime: { replaced: 2 },
      watchHistory: { replaced: 2, skipped: 1 },
    });

    const animeRows = listAnimeRows();
    expect(animeRows).toHaveLength(2);
    expect(animeRows[0]).toMatchObject({
      id: 7,
      title: '作品 A',
      coverUrl: 'https://lain.bgm.tv/pic/cover/l/example.jpg',
      localCoverUrl: null,
    });
    expect(animeRows[1]).toMatchObject({
      title: '作品 B',
      status: 'completed',
      progress: 12,
    });

    const historyRows = dbModule.getRawDb().prepare(`
      SELECT animeTitle, episode
      FROM watch_history
      ORDER BY watchedAt ASC
    `).all();
    expect(historyRows).toEqual([
      { animeTitle: '作品 A', episode: 1 },
      { animeTitle: '作品 B', episode: 12 },
    ]);
  });

  it('keeps existing data when validation fails before replacement', async () => {
    seedExistingAnime('应被保留');

    await expect(importModule.importAnimeData({
      anime: {
        records: [{
          id: 1,
          title: '日期错误',
          status: 'watching',
          premiereDate: '2026-02-30',
        }],
      },
    })).rejects.toThrow('必须是 YYYY-MM-DD 格式');

    expect(listAnimeRows().map((row) => row.title)).toEqual(['应被保留']);
  });

  it('rolls back deleted data when an insert fails inside the transaction', async () => {
    seedExistingAnime('事务前数据');
    const db = dbModule.getRawDb();
    db.exec(`
      CREATE TRIGGER reject_imported_anime
      BEFORE INSERT ON anime
      WHEN NEW.title = '触发失败'
      BEGIN
        SELECT RAISE(ABORT, 'simulated import failure');
      END;
    `);

    await expect(importModule.importAnimeData({
      anime: {
        records: [{
          id: 1,
          title: '触发失败',
          status: 'watching',
          progress: 0,
        }],
      },
    })).rejects.toThrow('simulated import failure');

    expect(listAnimeRows().map((row) => row.title)).toEqual(['事务前数据']);
  });
});
