import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let temporaryDirectory: string;
let dbModule: typeof import('../../lib/db');
let timelineModule: typeof import('../../lib/timeline-queries');

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'animetrack-timeline-test-'));
  process.env.DB_PATH = join(temporaryDirectory, 'animetrack.db');
  process.env.ANIMETRACK_BACKUPS_DIR = join(temporaryDirectory, 'backups');
  process.env.ANIMETRACK_COVERS_DIR = join(temporaryDirectory, 'covers');

  dbModule = await import('../../lib/db');
  timelineModule = await import('../../lib/timeline-queries');
  dbModule.getRawDb();
});

beforeEach(() => {
  const db = dbModule.getRawDb();
  db.exec(`
    DELETE FROM watch_history;
    DELETE FROM anime;

    INSERT INTO anime (id, title, original_title, status, progress, totalEpisodes)
    VALUES
      (1, '作品甲', 'Alpha Show', 'watching', 3, 12),
      (2, '作品乙', 'Beta Show', 'completed', 10, 10);

    INSERT INTO watch_history (id, animeId, animeTitle, episode, watchedAt)
    VALUES
      (1, 1, '作品甲', 2, '2026-07-25T01:00:00.000Z'),
      (2, 1, '作品甲', 3, '2026-07-27T01:00:00.000Z'),
      (3, 2, '作品乙', 3, '2026-07-26T01:00:00.000Z'),
      (4, 2, '作品乙', 10, '2026-07-24T01:00:00.000Z');
  `);
});

afterAll(() => {
  dbModule?.closeDb();
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  delete process.env.DB_PATH;
  delete process.env.ANIMETRACK_BACKUPS_DIR;
  delete process.env.ANIMETRACK_COVERS_DIR;
});

describe('timeline paginated queries', () => {
  it('paginates newest entries and returns compact anime fields', async () => {
    const result = await timelineModule.getTimelineEntries({
      page: 1,
      pageSize: 2,
      sortBy: 'newest',
    });

    expect(result).toMatchObject({
      total: 4,
      page: 1,
      pageSize: 2,
      totalPages: 2,
    });
    expect(result.records.map((entry) => entry.history.id)).toEqual([2, 3]);
    expect(result.records[0].anime).toMatchObject({
      id: 1,
      title: '作品甲',
      originalTitle: 'Alpha Show',
      status: 'watching',
      totalEpisodes: 12,
    });
    expect(result.summary).toBeUndefined();
  });

  it('uses watched time as the stable tie-breaker for episode sorting', async () => {
    const result = await timelineModule.getTimelineEntries({
      page: 1,
      pageSize: 4,
      sortBy: 'mostEpisodes',
    });

    expect(result.records.map((entry) => entry.history.id)).toEqual([4, 2, 3, 1]);
  });

  it('filters entries and summaries by an application-time calendar date', async () => {
    dbModule.getRawDb().exec(`
      INSERT INTO watch_history (id, animeId, animeTitle, episode, watchedAt)
      VALUES
        (5, 1, '作品甲', 4, '2026-07-26T16:00:00.000Z'),
        (6, 2, '作品乙', 11, '2026-07-27T16:00:00.000Z');
    `);

    const result = await timelineModule.getTimelineEntries({
      page: 1,
      pageSize: 10,
      date: '2026-07-27',
      sortBy: 'newest',
    });

    expect(result.total).toBe(2);
    expect(result.records.map((entry) => entry.history.id)).toEqual([2, 5]);
    expect(result.summary).toMatchObject([{
      animeId: 1,
      totalWatched: 2,
      latestEpisode: 4,
      lastEpisode: 3,
      firstWatched: '2026-07-26T16:00:00.000Z',
      lastWatched: '2026-07-27T01:00:00.000Z',
    }]);
  });

  it('rejects invalid calendar dates in timeline filters', async () => {
    await expect(timelineModule.getTimelineEntries({
      page: 1,
      pageSize: 10,
      date: '2026-02-31',
      sortBy: 'newest',
    })).rejects.toThrow('无效的日期筛选条件');
  });

  it('searches titles and original titles and summarizes every match', async () => {
    const result = await timelineModule.getTimelineEntries({
      page: 1,
      pageSize: 1,
      search: 'alpha',
      sortBy: 'oldest',
    });

    expect(result.total).toBe(2);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].history.id).toBe(1);
    expect(result.summary).toMatchObject([{
      animeId: 1,
      totalWatched: 2,
      latestEpisode: 3,
      lastEpisode: 3,
    }]);
  });

  it('orders unique anime by the latest watch and reports that record episode', async () => {
    const result = await timelineModule.getTimelineEntries({
      page: 1,
      pageSize: 1,
      search: 'beta',
      sortBy: 'newest',
    });

    expect(result.summary).toMatchObject([{
      animeId: 2,
      totalWatched: 2,
      latestEpisode: 10,
      lastEpisode: 3,
      lastWatched: '2026-07-26T01:00:00.000Z',
    }]);
  });
});
