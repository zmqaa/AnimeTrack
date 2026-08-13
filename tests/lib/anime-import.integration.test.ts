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
    DELETE FROM manga;
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
      datasets: ['anime'],
      anime: { selected: true, replaced: 2 },
      watchHistory: { selected: true, replaced: 2, skipped: 1 },
      manga: { selected: false, replaced: 0 },
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

    const importPromise = importModule.importAnimeData({
      anime: {
        records: [{
          id: 1,
          title: '日期错误',
          status: 'watching',
          premiereDate: '2026-02-30',
        }],
      },
    });

    await expect(importPromise).rejects.toBeInstanceOf(importModule.ImportValidationError);
    await expect(importPromise).rejects.toThrow('必须是 YYYY-MM-DD 格式');

    expect(listAnimeRows().map((row) => row.title)).toEqual(['应被保留']);
  });

  it('imports manga records with flexible chapter positions', async () => {
    const result = await importModule.importAnimeData({
      anime: { records: [{ title: '保留的番剧', status: 'watching', progress: 1 }] },
      manga: {
        records: [{
          id: 3,
          bangumiId: 230961,
          title: '飞野同学是笨蛋',
          status: 'reading',
          publicationStatus: 'completed',
          currentChapter: '42.5',
          authors: ['筋肉☆太郎'],
        }],
      },
    });

    expect(result.manga).toEqual({ selected: true, replaced: 1 });
    expect(dbModule.getRawDb().prepare(`
      SELECT id, bangumi_id, title, current_chapter, authors FROM manga
    `).get()).toEqual({
      id: 3,
      bangumi_id: 230961,
      title: '飞野同学是笨蛋',
      current_chapter: '42.5',
      authors: '["筋肉☆太郎"]',
    });
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

  it('replaces only manga when a manga-only file is imported', async () => {
    const animeId = seedExistingAnime('不受影响的番剧');
    dbModule.getRawDb().prepare(`
      INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt)
      VALUES (?, '不受影响的番剧', 1, '2026-08-04T00:00:00.000Z')
    `).run(animeId);

    const result = await importModule.importAnimeData({
      formatVersion: 5,
      datasets: ['manga'],
      manga: { records: [{ title: '只导入的漫画', status: 'reading' }] },
    });

    expect(result.datasets).toEqual(['manga']);
    expect(result.anime.selected).toBe(false);
    expect(listAnimeRows().map((row) => row.title)).toEqual(['不受影响的番剧']);
    expect(dbModule.getRawDb().prepare('SELECT COUNT(*) AS count FROM watch_history').get()).toEqual({ count: 1 });
    expect(dbModule.getRawDb().prepare('SELECT title FROM manga').get()).toEqual({ title: '只导入的漫画' });
  });

  it('keeps manga when only the anime data group is selected from a full file', async () => {
    dbModule.getRawDb().prepare(`
      INSERT INTO manga (title, status, publication_status) VALUES ('保留的漫画', 'reading', 'ongoing')
    `).run();

    const result = await importModule.importAnimeData({
      datasets: ['anime', 'manga'],
      selectedDatasets: ['anime'],
      anime: { records: [{ title: '新番剧', status: 'watching', progress: 1 }] },
      watchHistory: { records: [] },
      manga: { records: [{ title: '不导入的漫画', status: 'completed' }] },
    });

    expect(result.datasets).toEqual(['anime']);
    expect(result.manga.selected).toBe(false);
    expect(dbModule.getRawDb().prepare('SELECT title FROM manga').get()).toEqual({ title: '保留的漫画' });
  });
});
