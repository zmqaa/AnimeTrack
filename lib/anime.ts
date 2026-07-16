import 'server-only';
import { getRawDb, query, type DbResult } from './db';
import { parseJsonStringArray } from './anime-cast';
import { extractSeasonNumber, hasSeasonMarker, normalizeTitleToken } from './chinese-parser';
import { nowISO } from './date-utils';
import type { AnimeStatus } from './anime-shared';

export type { AnimeStatus };

/** 解析路由参数中的 ID */
export function parseAnimeId(idParam: string): number | null {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export interface AnimeRecord {
  id: number;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  status: AnimeStatus;
  score?: number;
  progress: number;
  totalEpisodes?: number;
  durationMinutes?: number;
  notes?: string;
  tags?: string[];
  cast?: string[];
  castAliases?: string[];
  summary?: string;
  startDate?: string;
  endDate?: string;
  premiereDate?: string;
  isFinished?: boolean;
  createdAt: string;
  updatedAt: string;
  lastWatchedAt?: string;
}

export interface CreateAnimeDTO {
  title: string;
  originalTitle?: string;
  coverUrl?: string | null;
  status: AnimeStatus;
  score?: number;
  progress: number;
  totalEpisodes?: number;
  durationMinutes?: number;
  notes?: string;
  tags?: string[];
  cast?: string[];
  castAliases?: string[];
  summary?: string;
  startDate?: string;
  endDate?: string;
  premiereDate?: string;
  isFinished?: boolean;
}

/** 将 AnimeRecord 转换为 CreateAnimeDTO */
export function animeRecordToDTO(record: AnimeRecord): CreateAnimeDTO {
  return {
    title: record.title,
    originalTitle: record.originalTitle,
    coverUrl: record.coverUrl,
    status: record.status,
    score: record.score,
    progress: record.progress,
    totalEpisodes: record.totalEpisodes,
    durationMinutes: record.durationMinutes,
    notes: record.notes,
    tags: record.tags,
    cast: record.cast,
    castAliases: record.castAliases,
    summary: record.summary,
    startDate: record.startDate,
    endDate: record.endDate,
    premiereDate: record.premiereDate,
    isFinished: record.isFinished,
  };
}

interface AnimeRow {
  id: number;
  title: string;
  original_title?: string | null;
  coverUrl?: string | null;
  status: AnimeStatus;
  score?: number | string | null;
  progress: number;
  totalEpisodes?: number | null;
  durationMinutes?: number | null;
  notes?: string | null;
  tags?: string | null;
  summary?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  premiere_date?: string | null;
  cast?: string | null;
  cast_aliases?: string | null;
  isFinished?: number | null;
  createdAt: string;
  updatedAt: string;
  lastWatchedAt?: string | null;
}

function mapRowToAnimeRecord(row: AnimeRow): AnimeRecord {
  return {
    id: row.id,
    title: row.title,
    originalTitle: row.original_title || undefined,
    coverUrl: row.coverUrl || undefined,
    status: row.status as AnimeStatus,
    score: row.score != null ? Number(row.score) : undefined,
    progress: row.progress,
    cast: parseJsonStringArray(row.cast),
    castAliases: parseJsonStringArray(row.cast_aliases),
    totalEpisodes: row.totalEpisodes ?? undefined,
    durationMinutes: row.durationMinutes ?? undefined,
    notes: row.notes || undefined,
    tags: parseJsonStringArray(row.tags),
    summary: row.summary || undefined,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    premiereDate: row.premiere_date || undefined,
    isFinished: row.isFinished != null ? Boolean(row.isFinished) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastWatchedAt: row.lastWatchedAt || undefined,
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, (char) => `!${char}`);
}

function normalizeComparableText(value: string | undefined): string {
  return normalizeTitleToken(value).replace(/第[一二三四五六七八九十百零两〇0-9]+[季期]/gi, '').trim();
}

function getCandidateSeason(row: AnimeRow): number | undefined {
  return extractSeasonNumber(row.title) || extractSeasonNumber(row.original_title || undefined);
}

function classifyPrefixSuffix(queryTitle: string, candidateTitle: string): 'none' | 'exact' | 'first-season' | 'later-season' | 'subtitle' {
  const trimmedQuery = queryTitle.trim();
  const trimmedCandidate = candidateTitle.trim();
  if (!trimmedQuery || !trimmedCandidate.startsWith(trimmedQuery)) return 'none';

  const suffix = trimmedCandidate.slice(trimmedQuery.length).trim();
  if (!suffix) return 'exact';
  if (/^第\s*[一1]\s*[季期]$/i.test(suffix) || /^season\s*1$/i.test(suffix) || /^s\s*1$/i.test(suffix)) return 'first-season';
  if (/^第\s*[0-9一二三四五六七八九十百零两〇]+\s*[季期]$/i.test(suffix) || /^season\s*[0-9]{1,3}$/i.test(suffix) || /^s\s*[0-9]{1,3}$/i.test(suffix)) return 'later-season';
  return 'subtitle';
}

function toSortableTime(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function scoreAnimeTitleCandidate(row: AnimeRow, queryTitle: string) {
  const trimmedQuery = queryTitle.trim();
  const queryToken = normalizeTitleToken(trimmedQuery);
  const queryComparable = normalizeComparableText(trimmedQuery);
  const queryHasSeason = hasSeasonMarker(trimmedQuery);
  const requestedSeason = extractSeasonNumber(trimmedQuery);

  const title = row.title.trim();
  const originalTitle = (row.original_title || '').trim();
  const titleToken = normalizeTitleToken(title);
  const originalTitleToken = normalizeTitleToken(originalTitle);
  const titleComparable = normalizeComparableText(title);
  const originalComparable = normalizeComparableText(originalTitle);
  const candidateSeason = getCandidateSeason(row);
  const prefixKind = classifyPrefixSuffix(trimmedQuery, title);

  let score = 0;
  if (title === trimmedQuery) score += 10000;
  if (originalTitle && originalTitle === trimmedQuery) score += 9500;
  if (titleToken === queryToken) score += 9000;
  if (originalTitleToken && originalTitleToken === queryToken) score += 8500;
  if (titleComparable && titleComparable === queryComparable) score += 8000;
  if (originalComparable && originalComparable === queryComparable) score += 7600;
  if (title.startsWith(trimmedQuery)) score += 1400;
  if (titleToken.startsWith(queryToken)) score += 1100;
  if (originalTitleToken && originalTitleToken.startsWith(queryToken)) score += 900;
  if (title.includes(trimmedQuery)) score += 500;
  if (titleToken.includes(queryToken)) score += 350;
  if (originalTitleToken && originalTitleToken.includes(queryToken)) score += 250;
  if (prefixKind === 'exact') score += 600;
  if (prefixKind === 'first-season') score += 520;

  if (queryHasSeason && requestedSeason) {
    if (candidateSeason === requestedSeason) score += 3200;
    else if (candidateSeason !== undefined) score -= Math.abs(candidateSeason - requestedSeason) * 700;
  } else {
    if (candidateSeason === 1) score += 450;
    else if (candidateSeason && candidateSeason > 1) score -= candidateSeason * 180;
    if (prefixKind === 'later-season') score -= 300;
    if (prefixKind === 'subtitle') score -= 120;
  }

  return {
    row,
    score,
    premiereTime: toSortableTime(row.premiere_date, Number.MAX_SAFE_INTEGER),
    createdTime: toSortableTime(row.createdAt, Number.MAX_SAFE_INTEGER),
    updatedTime: toSortableTime(row.updatedAt, 0),
  };
}

function pickBestAnimeTitleCandidate(rows: AnimeRow[], queryTitle: string): AnimeRow | null {
  if (rows.length === 0) return null;
  const queryHasSeason = hasSeasonMarker(queryTitle);
  const ranked = rows
    .map((row) => scoreAnimeTitleCandidate(row, queryTitle))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (!queryHasSeason && left.premiereTime !== right.premiereTime) return left.premiereTime - right.premiereTime;
      if (right.updatedTime !== left.updatedTime) return right.updatedTime - left.updatedTime;
      return left.createdTime - right.createdTime;
    });
  return ranked[0]?.row || null;
}

export interface ListAnimeOptions {
  status?: AnimeStatus;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedAnimeResult {
  records: AnimeRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SORT_COLUMN_MAP: Record<string, string> = {
  lastWatchedAt: 'latest_watch.lastWatchedAt',
  updatedAt: 'anime.updatedAt',
  createdAt: 'anime.createdAt',
  score: 'anime.score',
  progress: 'anime.progress',
  title: 'anime.title',
  startDate: 'anime.start_date',
  endDate: 'anime.end_date',
};

const LIST_COLUMNS_RAW = [
  'id', 'title', 'original_title', 'coverUrl', 'status', 'score',
  'progress', 'totalEpisodes', 'durationMinutes', 'tags',
  'start_date', 'end_date', 'premiere_date', 'isFinished',
  'cast', 'cast_aliases', 'summary',
  'createdAt', 'updatedAt',
];

const LIST_COLUMNS_WITH_TABLE = LIST_COLUMNS_RAW.map((col) => `anime.${col}`).join(', ');

export async function listAnimeRecords(options: ListAnimeOptions = {}): Promise<AnimeRecord[]> {
  const { status, limit, offset } = options;
  let sql = `SELECT ${LIST_COLUMNS_WITH_TABLE} FROM anime`;
  const params: unknown[] = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ' ORDER BY updatedAt DESC';

  if (limit && limit > 0) {
    sql += ' LIMIT ?';
    params.push(Math.floor(Number(limit)));
    if (offset && offset > 0) {
      sql += ' OFFSET ?';
      params.push(Math.floor(Number(offset)));
    }
  }

  const rows = await query<AnimeRow[]>(sql, params);
  return rows.map(mapRowToAnimeRecord);
}

export async function listAnimeRecordsWithLastWatched(options: ListAnimeOptions = {}): Promise<AnimeRecord[]> {
  const { status, limit, offset, search } = options;
  let sql = `
    SELECT ${LIST_COLUMNS_WITH_TABLE}, latest_watch.lastWatchedAt
    FROM anime
    LEFT JOIN (
      SELECT animeId, MAX(watchedAt) AS lastWatchedAt
      FROM watch_history
      GROUP BY animeId
    ) AS latest_watch ON latest_watch.animeId = anime.id
  `;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('anime.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(anime.title LIKE ? OR anime.original_title LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY anime.updatedAt DESC';

  if (limit && limit > 0) {
    sql += ' LIMIT ?';
    params.push(Math.floor(Number(limit)));
    if (offset && offset > 0) {
      sql += ' OFFSET ?';
      params.push(Math.floor(Number(offset)));
    }
  }

  const rows = await query<AnimeRow[]>(sql, params);
  return rows.map(mapRowToAnimeRecord);
}

export async function listAnimeRecordsPaginated(options: ListAnimeOptions = {}): Promise<PaginatedAnimeResult> {
  const { status, search, sortBy, sortOrder } = options;
  const page = Math.max(1, Math.floor(Number(options.limit) ? (Number(options.offset) / Number(options.limit) + 1) : 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 12)));
  const offset = (page - 1) * pageSize;

  const baseFrom = `
    FROM anime
    LEFT JOIN (
      SELECT animeId, MAX(watchedAt) AS lastWatchedAt
      FROM watch_history
      GROUP BY animeId
    ) AS latest_watch ON latest_watch.animeId = anime.id
  `;

  const params: unknown[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('anime.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(anime.title LIKE ? OR anime.original_title LIKE ? OR anime.cast LIKE ? OR anime.cast_aliases LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  // Count total
  const countParams = [...params];
  const countSql = `SELECT COUNT(*) as count ${baseFrom}${whereClause}`;
  const [countRow] = await query<{ count: number }[]>(countSql, countParams);
  const total = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Sort column
  const sortCol = SORT_COLUMN_MAP[sortBy || ''] || 'anime.updatedAt';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Handle nullable sorts (lastWatchedAt can be NULL for anime with no history)
  const nullsHandling = sortBy === 'lastWatchedAt'
    ? `${sortCol} IS NULL, ${sortCol} ${order}`
    : `${sortCol} ${order}`;

  const dataSql = `
    SELECT ${LIST_COLUMNS_WITH_TABLE}, latest_watch.lastWatchedAt
    ${baseFrom}${whereClause}
    ORDER BY ${nullsHandling}
    LIMIT ? OFFSET ?
  `;

  const dataParams = [...params, pageSize, offset];
  const rows = await query<AnimeRow[]>(dataSql, dataParams);

  return {
    records: rows.map(mapRowToAnimeRecord),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function countAnimeRecords(status?: AnimeStatus): Promise<number> {
  let sql = 'SELECT COUNT(*) as count FROM anime';
  const params: unknown[] = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  const rows = await query<{ count: number }[]>(sql, params);
  return Number(rows[0]?.count || 0);
}

export async function getAnimeRecord(id: number): Promise<AnimeRecord | null> {
  const rows = await query<AnimeRow[]>('SELECT * FROM anime WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  return mapRowToAnimeRecord(rows[0]);
}

export async function createAnimeRecord(input: CreateAnimeDTO): Promise<AnimeRecord> {
  const now = nowISO();
  const sql = `
    INSERT INTO anime (title, original_title, coverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, end_date, premiere_date, cast, cast_aliases, isFinished, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    input.title,
    input.originalTitle || null,
    input.coverUrl || null,
    input.status,
    input.score ?? null,
    input.progress,
    input.totalEpisodes ?? null,
    input.durationMinutes ?? null,
    input.notes || null,
    JSON.stringify(input.tags || []),
    input.summary || null,
    input.startDate || null,
    input.endDate || null,
    input.premiereDate || null,
    JSON.stringify(input.cast || []),
    JSON.stringify(input.castAliases || []),
    input.isFinished != null ? (input.isFinished ? 1 : 0) : null,
    now,
    now,
  ];

  const result = await query<DbResult>(sql, params);

  return {
    id: result.insertId,
    title: input.title,
    originalTitle: input.originalTitle,
    coverUrl: input.coverUrl || undefined,
    status: input.status,
    score: input.score,
    progress: input.progress,
    totalEpisodes: input.totalEpisodes,
    durationMinutes: input.durationMinutes,
    notes: input.notes,
    tags: input.tags || [],
    cast: input.cast || [],
    castAliases: input.castAliases || [],
    summary: input.summary,
    startDate: input.startDate,
    endDate: input.endDate,
    premiereDate: input.premiereDate,
    isFinished: input.isFinished != null ? Boolean(input.isFinished) : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/** 新建番剧，并可在同一事务中写入首条观看历史。 */
export function createAnimeRecordWithHistory(
  input: CreateAnimeDTO,
  history?: { episode: number; watchedAt?: Date },
): AnimeRecord {
  const db = getRawDb();
  const transaction = db.transaction(() => {
    const now = nowISO();
    const result = db.prepare(`
      INSERT INTO anime (title, original_title, coverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, end_date, premiere_date, cast, cast_aliases, isFinished, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.title, input.originalTitle || null, input.coverUrl || null, input.status,
      input.score ?? null, input.progress, input.totalEpisodes ?? null,
      input.durationMinutes ?? null, input.notes || null, JSON.stringify(input.tags || []),
      input.summary || null, input.startDate || null, input.endDate || null,
      input.premiereDate || null, JSON.stringify(input.cast || []),
      JSON.stringify(input.castAliases || []),
      input.isFinished == null ? null : (input.isFinished ? 1 : 0), now, now,
    );
    const id = Number(result.lastInsertRowid);
    if (history && history.episode > 0) {
      db.prepare(
        'INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES (?, ?, ?, ?)',
      ).run(id, input.title, history.episode, (history.watchedAt || new Date()).toISOString());
    }
    const row = db.prepare('SELECT * FROM anime WHERE id = ?').get(id) as AnimeRow;
    return mapRowToAnimeRecord(row);
  });
  return transaction();
}

export async function updateAnimeRecord(
  id: number,
  input: Partial<CreateAnimeDTO>
): Promise<AnimeRecord | null> {
  const fields: string[] = [];
  const params: unknown[] = [];

  // Always update updatedAt
  fields.push('updatedAt = ?');
  params.push(nowISO());

  if (input.originalTitle !== undefined) { fields.push('original_title = ?'); params.push(input.originalTitle); }
  if (input.title !== undefined) { fields.push('title = ?'); params.push(input.title); }
  if (input.coverUrl !== undefined) { fields.push('coverUrl = ?'); params.push(input.coverUrl); }
  if (input.status !== undefined) { fields.push('status = ?'); params.push(input.status); }
  if (input.score !== undefined) { fields.push('score = ?'); params.push(input.score); }
  if (input.progress !== undefined) { fields.push('progress = ?'); params.push(input.progress); }
  if (input.totalEpisodes !== undefined) { fields.push('totalEpisodes = ?'); params.push(input.totalEpisodes); }
  if (input.durationMinutes !== undefined) { fields.push('durationMinutes = ?'); params.push(input.durationMinutes); }
  if (input.notes !== undefined) { fields.push('notes = ?'); params.push(input.notes); }
  if (input.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(input.tags)); }
  if (input.summary !== undefined) { fields.push('summary = ?'); params.push(input.summary); }
  if (input.startDate !== undefined) { fields.push('start_date = ?'); params.push(input.startDate); }
  if (input.endDate !== undefined) { fields.push('end_date = ?'); params.push(input.endDate); }
  if (input.premiereDate !== undefined) { fields.push('premiere_date = ?'); params.push(input.premiereDate); }
  if (input.cast !== undefined) { fields.push('cast = ?'); params.push(JSON.stringify(input.cast)); }
  if (input.castAliases !== undefined) { fields.push('cast_aliases = ?'); params.push(JSON.stringify(input.castAliases)); }
  if (input.isFinished !== undefined) { fields.push('isFinished = ?'); params.push(input.isFinished == null ? null : (input.isFinished ? 1 : 0)); }

  if (fields.length <= 1) return await getAnimeRecord(id);

  const sql = `UPDATE anime SET ${fields.join(', ')} WHERE id = ? RETURNING *`;
  params.push(id);

  const rows = await query<AnimeRow[]>(sql, params);
  if (rows.length === 0) return null;
  return mapRowToAnimeRecord(rows[0]);
}

/**
 * 原子更新番剧进度及其观看历史，避免进度已保存但历史写入失败。
 */
export function updateAnimeRecordWithHistory(
  id: number,
  input: Partial<CreateAnimeDTO>,
  historyOptions: boolean | {
    recordHistory: boolean;
    watchedAt?: Date;
    replayEpisode?: number;
  },
): AnimeRecord | null {
  const options = typeof historyOptions === 'boolean'
    ? { recordHistory: historyOptions }
    : historyOptions;
  const db = getRawDb();
  const transaction = db.transaction(() => {
    const beforeRow = db.prepare('SELECT * FROM anime WHERE id = ?').get(id) as AnimeRow | undefined;
    if (!beforeRow) return null;

    const fields: string[] = ['updatedAt = ?'];
    const params: unknown[] = [nowISO()];
    const add = (column: string, value: unknown) => {
      fields.push(`${column} = ?`);
      params.push(value);
    };

    if (input.originalTitle !== undefined) add('original_title', input.originalTitle);
    if (input.title !== undefined) add('title', input.title);
    if (input.coverUrl !== undefined) add('coverUrl', input.coverUrl);
    if (input.status !== undefined) add('status', input.status);
    if (input.score !== undefined) add('score', input.score);
    if (input.progress !== undefined) add('progress', input.progress);
    if (input.totalEpisodes !== undefined) add('totalEpisodes', input.totalEpisodes);
    if (input.durationMinutes !== undefined) add('durationMinutes', input.durationMinutes);
    if (input.notes !== undefined) add('notes', input.notes);
    if (input.tags !== undefined) add('tags', JSON.stringify(input.tags));
    if (input.summary !== undefined) add('summary', input.summary);
    if (input.startDate !== undefined) add('start_date', input.startDate);
    if (input.endDate !== undefined) add('end_date', input.endDate);
    if (input.premiereDate !== undefined) add('premiere_date', input.premiereDate);
    if (input.cast !== undefined) add('cast', JSON.stringify(input.cast));
    if (input.castAliases !== undefined) add('cast_aliases', JSON.stringify(input.castAliases));
    if (input.isFinished !== undefined) add('isFinished', input.isFinished == null ? null : (input.isFinished ? 1 : 0));

    if (fields.length > 1) {
      db.prepare(`UPDATE anime SET ${fields.join(', ')} WHERE id = ?`).run(...params, id);
    }

    const updatedRow = db.prepare('SELECT * FROM anime WHERE id = ?').get(id) as AnimeRow | undefined;
    if (!updatedRow) return null;

    const beforeProgress = Number(beforeRow.progress) || 0;
    const updatedProgress = Number(updatedRow.progress) || 0;
    const delta = updatedProgress - beforeProgress;
    if (delta > 0 && options.recordHistory) {
      const watchedAt = (options.watchedAt || new Date()).toISOString();
      const insert = db.prepare(
        'INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES (?, ?, ?, ?)',
      );
      for (let episode = beforeProgress + 1; episode <= updatedProgress; episode++) {
        insert.run(id, updatedRow.title, episode, watchedAt);
      }
    } else if (delta === 0 && options.recordHistory && options.replayEpisode && options.replayEpisode > 0) {
      db.prepare(
        'INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES (?, ?, ?, ?)',
      ).run(id, updatedRow.title, options.replayEpisode, (options.watchedAt || new Date()).toISOString());
    } else if (delta < 0) {
      db.prepare('DELETE FROM watch_history WHERE animeId = ? AND episode > ?').run(id, updatedProgress);
    }

    return mapRowToAnimeRecord(updatedRow);
  });

  return transaction();
}

export async function deleteAnimeRecord(id: number): Promise<void> {
  await query('DELETE FROM anime WHERE id = ?', [id]);
}

export async function findAnimeByTitle(title: string): Promise<AnimeRecord | null> {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return null;

  const escapedTitle = escapeLikePattern(normalizedTitle);
  const rows = await query<AnimeRow[]>(
    `
      SELECT *
      FROM anime
      WHERE title = ?
         OR original_title = ?
         OR title LIKE ? ESCAPE '!'
         OR title LIKE ? ESCAPE '!'
         OR original_title LIKE ? ESCAPE '!'
         OR original_title LIKE ? ESCAPE '!'
      LIMIT 50
    `,
    [normalizedTitle, normalizedTitle, `${escapedTitle}%`, `%${escapedTitle}%`, `${escapedTitle}%`, `%${escapedTitle}%`]
  );

  const bestCandidate = pickBestAnimeTitleCandidate(rows, normalizedTitle);
  if (!bestCandidate) return null;
  return mapRowToAnimeRecord(bestCandidate);
}

export async function listAnimeRecordsByExactTitle(title: string): Promise<AnimeRecord[]> {
  const rows = await query<AnimeRow[]>('SELECT * FROM anime WHERE title = ? ORDER BY createdAt DESC', [title]);
  return rows.map(mapRowToAnimeRecord);
}

export async function updateAnimeProgress(id: number, progress: number): Promise<void> {
  const now = nowISO();
  await query('UPDATE anime SET progress = ?, updatedAt = ? WHERE id = ?', [progress, now, id]);
}
