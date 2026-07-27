import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let temporaryDirectory: string;
let animeModule: typeof import('../../lib/anime');
let animeNotesModule: typeof import('../../lib/anime-notes');
let dbModule: typeof import('../../lib/db');

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'animetrack-test-'));
  process.env.DB_PATH = join(temporaryDirectory, 'animetrack.db');
  process.env.ANIMETRACK_BACKUPS_DIR = join(temporaryDirectory, 'backups');
  process.env.ANIMETRACK_COVERS_DIR = join(temporaryDirectory, 'covers');

  animeModule = await import('../../lib/anime');
  animeNotesModule = await import('../../lib/anime-notes');
  dbModule = await import('../../lib/db');
  dbModule.getRawDb();
});

beforeEach(() => {
  const db = dbModule.getRawDb();
  db.exec(`
    DROP TRIGGER IF EXISTS reject_watch_history_insert;
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

async function createWatchingAnime() {
  return animeModule.createAnimeRecord({
    title: '测试番剧',
    status: 'watching',
    progress: 0,
    totalEpisodes: 12,
  });
}

function readHistory(animeId: number) {
  return dbModule.getRawDb().prepare(`
    SELECT episode, watchedAt
    FROM watch_history
    WHERE animeId = ?
    ORDER BY episode ASC
  `).all(animeId) as Array<{ episode: number; watchedAt: string }>;
}

describe('anime progress and watch history transaction', () => {
  it('includes personal notes when listing anime for export', async () => {
    await animeModule.createAnimeRecord({
      title: '带备注的番剧',
      status: 'completed',
      progress: 12,
      notes: '这是一条个人备注',
    });

    const records = await animeModule.listAnimeRecords();

    expect(records).toHaveLength(1);
    expect(records[0].notes).toBe('这是一条个人备注');
    expect(animeNotesModule.listAnimeNotes(records[0].id)).toMatchObject([
      { episode: undefined, content: '这是一条个人备注' },
    ]);
  });

  it('creates, updates and deletes an episode note', async () => {
    const anime = await createWatchingAnime();
    const created = animeNotesModule.createEpisodeNote(anime.id, {
      episode: 2,
      content: '第一次记录',
      notedAt: '2026-07-20',
    });

    expect(created).toMatchObject({
      animeId: anime.id,
      episode: 2,
      content: '第一次记录',
      notedAt: '2026-07-20',
    });

    const updated = animeNotesModule.updateAnimeNote(anime.id, created!.id, {
      episode: 3,
      content: '修改后的记录',
      notedAt: '2026-07-21',
    });
    expect(updated).toMatchObject({
      episode: 3,
      content: '修改后的记录',
      notedAt: '2026-07-21',
    });

    expect(animeNotesModule.deleteAnimeNote(anime.id, created!.id)).toBe(true);
    expect(animeNotesModule.listAnimeNotes(anime.id)).toEqual([]);
  });

  it('replaces episode-note drafts while preserving the overall note', async () => {
    const anime = await animeModule.createAnimeRecord({
      title: '统一编辑备注',
      status: 'watching',
      progress: 2,
      notes: '保留的总备注',
    });
    animeNotesModule.createEpisodeNote(anime.id, {
      episode: 1,
      content: '旧随记',
      notedAt: '2026-07-20',
    });

    const notes = animeNotesModule.replaceEpisodeNotes(anime.id, [{
      episode: 2,
      content: '保存后的新随记',
      notedAt: '2026-07-21',
    }]);

    expect(notes).toMatchObject([
      { episode: undefined, content: '保留的总备注' },
      { episode: 2, content: '保存后的新随记', notedAt: '2026-07-21' },
    ]);
  });

  it('writes every newly watched episode when progress increases', async () => {
    const anime = await createWatchingAnime();
    const watchedAt = new Date('2026-07-25T12:30:00.000Z');

    const updated = animeModule.updateAnimeRecordWithHistory(
      anime.id,
      { progress: 3 },
      { recordHistory: true, watchedAt },
    );

    expect(updated?.progress).toBe(3);
    expect(readHistory(anime.id)).toEqual([
      { episode: 1, watchedAt: watchedAt.toISOString() },
      { episode: 2, watchedAt: watchedAt.toISOString() },
      { episode: 3, watchedAt: watchedAt.toISOString() },
    ]);
    expect(updated?.startDate).toBe('2026-07-25');
  });

  it('fills a missing start date in app time and preserves a manual date', async () => {
    const automatic = await createWatchingAnime();
    const manual = await animeModule.createAnimeRecord({
      title: '人工日期番剧',
      status: 'watching',
      progress: 0,
      totalEpisodes: 12,
      startDate: '2026-07-01',
    });
    const watchedAt = new Date('2026-07-25T16:30:00.000Z');

    const automaticUpdated = animeModule.adjustAnimeProgressWithHistory(
      automatic.id,
      1,
      { recordHistory: true, watchedAt },
    );
    const manualUpdated = animeModule.adjustAnimeProgressWithHistory(
      manual.id,
      1,
      { recordHistory: true, watchedAt },
    );

    expect(automaticUpdated?.startDate).toBe('2026-07-26');
    expect(automaticUpdated?.startDateSource).toBe('history');
    expect(manualUpdated?.startDate).toBe('2026-07-01');

    const automaticReverted = animeModule.adjustAnimeProgressWithHistory(
      automatic.id,
      -1,
      { recordHistory: false, trimHistoryOnProgressDecrease: true },
    );
    const manualReverted = animeModule.adjustAnimeProgressWithHistory(
      manual.id,
      -1,
      { recordHistory: false, trimHistoryOnProgressDecrease: true },
    );

    expect(automaticReverted?.startDate).toBeUndefined();
    expect(automaticReverted?.startDateSource).toBeUndefined();
    expect(manualReverted?.startDate).toBe('2026-07-01');
  });

  it('applies repeated progress increments to the latest stored value', async () => {
    const anime = await createWatchingAnime();

    const first = animeModule.adjustAnimeProgressWithHistory(
      anime.id,
      1,
      { recordHistory: true },
    );
    const second = animeModule.adjustAnimeProgressWithHistory(
      anime.id,
      1,
      { recordHistory: true },
    );

    expect(first?.progress).toBe(1);
    expect(second?.progress).toBe(2);
    expect(readHistory(anime.id).map((row) => row.episode)).toEqual([1, 2]);
  });

  it('clamps progress at the total and restores watching status after decrementing', async () => {
    const anime = await createWatchingAnime();
    animeModule.updateAnimeRecordWithHistory(
      anime.id,
      { progress: 11 },
      { recordHistory: true },
    );

    const completed = animeModule.adjustAnimeProgressWithHistory(
      anime.id,
      1,
      { recordHistory: true },
    );
    const clamped = animeModule.adjustAnimeProgressWithHistory(
      anime.id,
      1,
      { recordHistory: true },
    );
    const resumed = animeModule.adjustAnimeProgressWithHistory(
      anime.id,
      -1,
      { recordHistory: false, trimHistoryOnProgressDecrease: true },
    );

    expect(completed?.progress).toBe(12);
    expect(completed?.status).toBe('completed');
    expect(clamped?.progress).toBe(12);
    expect(resumed?.progress).toBe(11);
    expect(resumed?.status).toBe('watching');
    expect(readHistory(anime.id).map((row) => row.episode)).toEqual(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
  });

  it('rolls back an atomic increment when writing its history fails', async () => {
    const anime = await createWatchingAnime();
    const db = dbModule.getRawDb();
    db.exec(`
      CREATE TRIGGER reject_watch_history_insert
      BEFORE INSERT ON watch_history
      BEGIN
        SELECT RAISE(ABORT, 'simulated atomic increment failure');
      END;
    `);

    expect(() => animeModule.adjustAnimeProgressWithHistory(
      anime.id,
      1,
      { recordHistory: true },
    )).toThrow('simulated atomic increment failure');

    const stored = db.prepare('SELECT progress FROM anime WHERE id = ?').get(anime.id) as {
      progress: number;
    };
    expect(stored.progress).toBe(0);
    expect(readHistory(anime.id)).toEqual([]);
  });

  it('can update progress without creating watch history', async () => {
    const anime = await createWatchingAnime();

    const updated = animeModule.updateAnimeRecordWithHistory(
      anime.id,
      { progress: 2 },
      { recordHistory: false },
    );

    expect(updated?.progress).toBe(2);
    expect(readHistory(anime.id)).toEqual([]);
  });

  it('does not decrease progress unless history trimming is explicitly requested', async () => {
    const anime = await createWatchingAnime();
    animeModule.updateAnimeRecordWithHistory(anime.id, { progress: 4 }, { recordHistory: true });

    const unchanged = animeModule.updateAnimeRecordWithHistory(
      anime.id,
      { progress: 2 },
      { recordHistory: false },
    );

    expect(unchanged?.progress).toBe(4);
    expect(readHistory(anime.id).map((row) => row.episode)).toEqual([1, 2, 3, 4]);
  });

  it('trims later history entries when progress is deliberately decreased', async () => {
    const anime = await createWatchingAnime();
    animeModule.updateAnimeRecordWithHistory(anime.id, { progress: 4 }, { recordHistory: true });

    const updated = animeModule.updateAnimeRecordWithHistory(
      anime.id,
      { progress: 2 },
      { recordHistory: false, trimHistoryOnProgressDecrease: true },
    );

    expect(updated?.progress).toBe(2);
    expect(readHistory(anime.id).map((row) => row.episode)).toEqual([1, 2]);
  });

  it('records a replay without changing progress', async () => {
    const anime = await createWatchingAnime();
    animeModule.updateAnimeRecordWithHistory(anime.id, { progress: 2 }, { recordHistory: true });

    animeModule.updateAnimeRecordWithHistory(
      anime.id,
      {},
      { recordHistory: true, replayEpisode: 2 },
    );

    expect(readHistory(anime.id).map((row) => row.episode)).toEqual([1, 2, 2]);
  });

  it('rolls back the progress change when writing history fails', async () => {
    const anime = await createWatchingAnime();
    const db = dbModule.getRawDb();
    db.exec(`
      CREATE TRIGGER reject_watch_history_insert
      BEFORE INSERT ON watch_history
      BEGIN
        SELECT RAISE(ABORT, 'simulated history failure');
      END;
    `);

    expect(() => animeModule.updateAnimeRecordWithHistory(
      anime.id,
      { progress: 2 },
      { recordHistory: true },
    )).toThrow('simulated history failure');

    const stored = db.prepare('SELECT progress FROM anime WHERE id = ?').get(anime.id) as {
      progress: number;
    };
    expect(stored.progress).toBe(0);
    expect(readHistory(anime.id)).toEqual([]);
  });

  it('filters paginated anime by tag and cast on the server', async () => {
    const matching = await animeModule.createAnimeRecord({
      title: '服务端筛选目标',
      status: 'watching',
      progress: 3,
      tags: ['日常', '治愈'],
      cast: ['Kana Hanazawa'],
      castAliases: ['花泽香菜'],
    });
    await animeModule.createAnimeRecord({
      title: '其他作品',
      status: 'completed',
      progress: 12,
      tags: ['动作'],
      cast: ['Other Actor'],
    });

    const byTag = await animeModule.listAnimeRecordsPaginated({
      tag: '治愈',
      limit: 12,
    });
    const byCast = await animeModule.listAnimeRecordsPaginated({
      cast: '花泽香菜',
      limit: 12,
    });

    expect(byTag.total).toBe(1);
    expect(byTag.records.map((item) => item.id)).toEqual([matching.id]);
    expect(byCast.total).toBe(1);
    expect(byCast.records.map((item) => item.id)).toEqual([matching.id]);
  });

  it('builds a lightweight overview with stats, facets and recent watches', async () => {
    const recent = await animeModule.createAnimeRecord({
      title: '最近观看作品',
      status: 'watching',
      progress: 3,
      durationMinutes: 25,
      tags: ['日常', '治愈'],
      cast: ['Kana Hanazawa'],
      castAliases: ['花泽香菜'],
    });
    await animeModule.createAnimeRecord({
      title: '已完成作品',
      status: 'completed',
      progress: 12,
      tags: ['日常'],
    });
    dbModule.getRawDb().prepare(`
      INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt)
      VALUES (?, ?, ?, ?)
    `).run(recent.id, recent.title, 3, '2026-07-26T10:00:00.000Z');

    const overview = await animeModule.getAnimeListOverview();

    expect(overview.stats).toEqual({
      libraryWorks: 2,
      watchedWorks: 2,
      completedWorks: 1,
      watchingWorks: 1,
      droppedWorks: 0,
      plannedWorks: 0,
      rewatchRuns: 0,
      completedRewatchRuns: 0,
      watchedEpisodes: 15,
      rewatchEpisodes: 0,
      totalMinutes: 363,
    });
    expect(overview.tagPreferences).toEqual([
      { tag: '日常', count: 2 },
      { tag: '治愈', count: 1 },
    ]);
    expect(overview.voiceActorSuggestions).toContain('花泽香菜');
    expect(overview.recentWatchItems).toHaveLength(1);
    expect(overview.recentWatchItems[0]).toMatchObject({
      id: recent.id,
      lastWatchedAt: '2026-07-26T10:00:00.000Z',
    });
  });
});
