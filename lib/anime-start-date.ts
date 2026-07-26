import 'server-only';

import type Database from 'better-sqlite3';

import { formatAppDateKey } from './date-utils';

interface EarliestHistoryRow {
  animeId: number;
  startDate: string | null;
  startDateSource: string | null;
  firstWatchedAt: string | null;
}

/**
 * 将单部番剧的自动开始日期与观看历史同步。
 * 来源为空的非空日期视为人工数据，绝不修改。
 */
export function syncAnimeStartDateFromHistory(
  db: Database.Database,
  animeId: number,
): boolean {
  const row = db.prepare(`
    SELECT
      anime.id AS animeId,
      anime.start_date AS startDate,
      anime.start_date_source AS startDateSource,
      MIN(watch_history.watchedAt) AS firstWatchedAt
    FROM anime
    LEFT JOIN watch_history ON watch_history.animeId = anime.id
    WHERE anime.id = ?
    GROUP BY anime.id
  `).get(animeId) as EarliestHistoryRow | undefined;

  if (!row) return false;

  const hasStartDate = Boolean(row.startDate?.trim());
  const isHistoryDate = row.startDateSource === 'history';
  if (hasStartDate && !isHistoryDate) return false;

  if (row.firstWatchedAt) {
    try {
      const startDate = formatAppDateKey(row.firstWatchedAt);
      return db.prepare(`
        UPDATE anime
        SET start_date = ?, start_date_source = 'history'
        WHERE id = ?
      `).run(startDate, animeId).changes > 0;
    } catch {
      return false;
    }
  }

  if (isHistoryDate) {
    return db.prepare(`
      UPDATE anime
      SET start_date = NULL, start_date_source = NULL
      WHERE id = ?
    `).run(animeId).changes > 0;
  }

  return false;
}

/** 用最早观看历史批量补齐空缺的开始日期。 */
export function backfillMissingAnimeStartDates(db: Database.Database): number {
  const rows = db.prepare(`
    SELECT anime.id AS animeId
    FROM anime
    INNER JOIN watch_history ON watch_history.animeId = anime.id
    WHERE anime.start_date IS NULL OR trim(anime.start_date) = ''
    GROUP BY anime.id
  `).all() as Array<{ animeId: number }>;

  let updatedCount = 0;
  for (const row of rows) {
    if (syncAnimeStartDateFromHistory(db, row.animeId)) updatedCount++;
  }
  return updatedCount;
}
