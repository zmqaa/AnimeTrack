import 'server-only';

import { resolveDisplayCoverUrl, resolveThumbnailCoverUrl } from './cover-image';
import { query } from './db';
import type { WatchHistoryRecord } from './dashboard-types';
import type { AnimeStatus } from './anime-shared';
import type {
  TimelineAnimeItem,
  TimelineAnimeSummaryData,
  TimelineEntriesResponse,
  TimelineSortBy,
} from './timeline-types';

interface TimelineAnimeRow {
  id: number;
  title: string;
  originalTitle: string | null;
  coverUrl: string | null;
  localCoverUrl: string | null;
  status: AnimeStatus;
  totalEpisodes: number | null;
}

interface TimelineEntryRow extends TimelineAnimeRow {
  historyId: number;
  animeId: number;
  animeTitle: string;
  episode: number;
  watchedAt: string;
}

interface TimelineSummaryRow extends TimelineAnimeRow {
  animeId: number;
  totalWatched: number;
  latestEpisode: number;
  lastEpisode: number;
  lastHistoryId: number;
  firstWatched: string;
  lastWatched: string;
}

function mapAnime(row: TimelineAnimeRow): TimelineAnimeItem {
  return {
    id: row.id,
    title: row.title,
    originalTitle: row.originalTitle || undefined,
    status: row.status,
    totalEpisodes: row.totalEpisodes,
    displayCoverUrl: resolveDisplayCoverUrl(row.localCoverUrl, row.coverUrl),
    thumbnailCoverUrl: resolveThumbnailCoverUrl(row.localCoverUrl, row.coverUrl),
  };
}

function buildSearchClause(search?: string) {
  const normalized = search?.trim();
  if (!normalized) return { sql: '', params: [] as unknown[] };
  const escaped = normalized.replace(/[\\%_]/g, '\\$&');
  return {
    sql: " WHERE (a.title LIKE ? ESCAPE '\\' OR a.original_title LIKE ? ESCAPE '\\')",
    params: [`%${escaped}%`, `%${escaped}%`],
  };
}

export async function listTimelineAnime(): Promise<TimelineAnimeItem[]> {
  const rows = await query<TimelineAnimeRow[]>(`
    SELECT
      id,
      title,
      original_title AS originalTitle,
      coverUrl,
      localCoverUrl,
      status,
      totalEpisodes
    FROM anime
  `);
  return rows.map(mapAnime);
}

export async function listTimelineHistory(): Promise<WatchHistoryRecord[]> {
  return query<WatchHistoryRecord[]>(`
    SELECT id, animeId, animeTitle, episode, watchedAt
    FROM watch_history
    ORDER BY watchedAt DESC, id DESC
  `);
}

async function getTimelineSummary(search: string): Promise<TimelineAnimeSummaryData[]> {
  const filter = buildSearchClause(search);
  const rows = await query<TimelineSummaryRow[]>(`
    SELECT
      a.id,
      a.id AS animeId,
      a.title,
      a.original_title AS originalTitle,
      a.coverUrl,
      a.localCoverUrl,
      a.status,
      a.totalEpisodes,
      COUNT(*) AS totalWatched,
      MAX(h.episode) AS latestEpisode,
      (
        SELECT latest.episode
        FROM watch_history latest
        WHERE latest.animeId = a.id
        ORDER BY latest.watchedAt DESC, latest.id DESC
        LIMIT 1
      ) AS lastEpisode,
      (
        SELECT latest.id
        FROM watch_history latest
        WHERE latest.animeId = a.id
        ORDER BY latest.watchedAt DESC, latest.id DESC
        LIMIT 1
      ) AS lastHistoryId,
      MIN(h.watchedAt) AS firstWatched,
      MAX(h.watchedAt) AS lastWatched
    FROM watch_history h
    INNER JOIN anime a ON a.id = h.animeId
    ${filter.sql}
    GROUP BY a.id
    ORDER BY lastWatched DESC, lastHistoryId DESC, a.id ASC
  `, filter.params);

  return rows.map((row) => ({
    animeId: row.animeId,
    title: row.title,
    originalTitle: row.originalTitle || undefined,
    coverUrl: resolveDisplayCoverUrl(row.localCoverUrl, row.coverUrl),
    status: row.status,
    totalWatched: Number(row.totalWatched),
    latestEpisode: Number(row.latestEpisode),
    lastEpisode: Number(row.lastEpisode),
    totalEpisodes: row.totalEpisodes,
    firstWatched: row.firstWatched,
    lastWatched: row.lastWatched,
    sessionCount: Number(row.totalWatched),
  }));
}

export async function getTimelineEntries(options: {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: TimelineSortBy;
}): Promise<TimelineEntriesResponse> {
  const filter = buildSearchClause(options.search);
  const orderBy = options.sortBy === 'oldest'
    ? 'h.watchedAt ASC, h.id ASC'
    : options.sortBy === 'mostEpisodes'
      ? 'h.episode DESC, h.watchedAt DESC, h.id DESC'
      : 'h.watchedAt DESC, h.id DESC';
  const [countRow] = await query<Array<{ total: number }>>(`
    SELECT COUNT(*) AS total
    FROM watch_history h
    INNER JOIN anime a ON a.id = h.animeId
    ${filter.sql}
  `, filter.params);
  const total = Number(countRow?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const offset = (page - 1) * options.pageSize;

  const rows = await query<TimelineEntryRow[]>(`
    SELECT
      h.id AS historyId,
      h.animeId,
      h.animeTitle,
      h.episode,
      h.watchedAt,
      a.id,
      a.title,
      a.original_title AS originalTitle,
      a.coverUrl,
      a.localCoverUrl,
      a.status,
      a.totalEpisodes
    FROM watch_history h
    INNER JOIN anime a ON a.id = h.animeId
    ${filter.sql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `, [...filter.params, options.pageSize, offset]);

  return {
    records: rows.map((row) => ({
      history: {
        id: row.historyId,
        animeId: row.animeId,
        animeTitle: row.animeTitle,
        episode: row.episode,
        watchedAt: row.watchedAt,
      },
      anime: mapAnime(row),
    })),
    summary: options.search?.trim() ? await getTimelineSummary(options.search) : undefined,
    total,
    page,
    pageSize: options.pageSize,
    totalPages,
  };
}
