import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let temporaryDirectory: string;
let animeModule: typeof import('../../lib/anime');
let dbModule: typeof import('../../lib/db');

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'animetrack-test-'));
  process.env.DB_PATH = join(temporaryDirectory, 'animetrack.db');
  process.env.ANIMETRACK_BACKUPS_DIR = join(temporaryDirectory, 'backups');
  process.env.ANIMETRACK_COVERS_DIR = join(temporaryDirectory, 'covers');

  animeModule = await import('../../lib/anime');
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
});
