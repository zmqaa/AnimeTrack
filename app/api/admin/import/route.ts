import { NextRequest } from 'next/server';
import { type RowDataPacket, type ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { type AnimeStatus, type CreateAnimeDTO } from '@/lib/anime';
import { pool } from '@/lib/db';

interface ImportAnimeRecord extends Partial<CreateAnimeDTO> {
  id?: number;
  title: string;
}

interface ImportWatchHistoryRecord {
  id?: number;
  animeId?: number;
  animeTitle?: string;
  episode?: number;
  watchedAt?: string;
}

interface ExportPayload {
  records?: ImportAnimeRecord[];
  anime?: {
    records?: ImportAnimeRecord[];
  };
  watchHistory?: {
    records?: ImportWatchHistoryRecord[];
  };
}

interface ExistingHistoryRow extends RowDataPacket {
  id: number;
}

interface AnimeLookupRow extends RowDataPacket {
  id: number;
  title: string;
}

interface ResolvedAnimeRecord {
  id: number;
  title: string;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === '1' || value === 1) {
    return true;
  }

  if (value === 'false' || value === '0' || value === 0) {
    return false;
  }

  return undefined;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toOptionalDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [];
}

function normalizeAnimePayload(item: ImportAnimeRecord): CreateAnimeDTO {
  return {
    title: item.title.trim(),
    originalTitle: toOptionalString(item.originalTitle),
    coverUrl: toOptionalString(item.coverUrl),
    status: (toOptionalString(item.status) as AnimeStatus | undefined) || 'plan_to_watch',
    score: toOptionalNumber(item.score),
    progress: toOptionalNumber(item.progress) ?? 0,
    totalEpisodes: toOptionalNumber(item.totalEpisodes),
    durationMinutes: toOptionalNumber(item.durationMinutes),
    notes: toOptionalString(item.notes),
    tags: toStringArray(item.tags),
    cast: toStringArray(item.cast),
    castAliases: toStringArray(item.castAliases),
    summary: toOptionalString(item.summary),
    startDate: toOptionalString(item.startDate),
    endDate: toOptionalString(item.endDate),
    premiereDate: toOptionalString(item.premiereDate),
    isFinished: toOptionalBoolean(item.isFinished),
  };
}

async function findAnimeByExactTitle(connection: PoolConnection, title: string) {
  const [rows] = await connection.query<AnimeLookupRow[]>(
    'SELECT id, title FROM anime WHERE title = ? OR original_title = ? ORDER BY id DESC LIMIT 1',
    [title, title]
  );
  return rows[0] ? { id: rows[0].id, title: rows[0].title } satisfies ResolvedAnimeRecord : null;
}

async function createAnimeWithConnection(connection: PoolConnection, payload: CreateAnimeDTO) {
  const [result] = await connection.query<ResultSetHeader>(
    `
      INSERT INTO anime (title, original_title, coverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, end_date, premiere_date, cast, cast_aliases, isFinished)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.title,
      payload.originalTitle || null,
      payload.coverUrl || null,
      payload.status,
      payload.score ?? null,
      payload.progress,
      payload.totalEpisodes ?? null,
      payload.durationMinutes ?? null,
      payload.notes || null,
      JSON.stringify(payload.tags || []),
      payload.summary || null,
      payload.startDate || null,
      payload.endDate || null,
      payload.premiereDate || null,
      JSON.stringify(payload.cast || []),
      JSON.stringify(payload.castAliases || []),
      payload.isFinished != null ? (payload.isFinished ? 1 : 0) : null,
    ]
  );

  return {
    id: result.insertId,
    title: payload.title,
  } satisfies ResolvedAnimeRecord;
}

async function updateAnimeWithConnection(connection: PoolConnection, id: number, payload: CreateAnimeDTO) {
  await connection.query(
    `
      UPDATE anime
      SET title = ?, original_title = ?, coverUrl = ?, status = ?, score = ?, progress = ?, totalEpisodes = ?, durationMinutes = ?, notes = ?, tags = ?, summary = ?, start_date = ?, end_date = ?, premiere_date = ?, cast = ?, cast_aliases = ?, isFinished = ?
      WHERE id = ?
    `,
    [
      payload.title,
      payload.originalTitle || null,
      payload.coverUrl || null,
      payload.status,
      payload.score ?? null,
      payload.progress,
      payload.totalEpisodes ?? null,
      payload.durationMinutes ?? null,
      payload.notes || null,
      JSON.stringify(payload.tags || []),
      payload.summary || null,
      payload.startDate || null,
      payload.endDate || null,
      payload.premiereDate || null,
      JSON.stringify(payload.cast || []),
      JSON.stringify(payload.castAliases || []),
      payload.isFinished != null ? (payload.isFinished ? 1 : 0) : null,
      id,
    ]
  );

  return {
    id,
    title: payload.title,
  } satisfies ResolvedAnimeRecord;
}

async function resolveAnimeRecord(connection: PoolConnection, item: ImportAnimeRecord) {
  const payload = normalizeAnimePayload(item);
  const existing = await findAnimeByExactTitle(connection, payload.title);

  if (existing) {
    const updated = await updateAnimeWithConnection(connection, existing.id, payload);
    return { record: updated, created: false };
  }

  const created = await createAnimeWithConnection(connection, payload);
  return { record: created, created: true };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('只有管理员可以导入数据');
  if (!auth.authorized) {
    return auth.response;
  }

  const connection = await pool.getConnection();

  try {
    const body = await request.json() as ExportPayload;
    const animeRecords = Array.isArray(body.anime?.records)
      ? body.anime.records
      : (Array.isArray(body.records) ? body.records : []);
    const historyRecords = Array.isArray(body.watchHistory?.records)
      ? body.watchHistory.records
      : [];

    if (animeRecords.length === 0 && historyRecords.length === 0) {
      return apiError('JSON 中没有可导入的数据', 400);
    }

    await connection.beginTransaction();

    const animeIdMap = new Map<number, ResolvedAnimeRecord>();
    const animeTitleMap = new Map<string, ResolvedAnimeRecord>();
    let createdAnime = 0;
    let updatedAnime = 0;

    for (const item of animeRecords) {
      if (!item || typeof item.title !== 'string' || !item.title.trim()) {
        continue;
      }

      const result = await resolveAnimeRecord(connection, item);
      const normalizedTitle = result.record.title.trim();
      animeTitleMap.set(normalizedTitle, result.record);

      if (typeof item.id === 'number') {
        animeIdMap.set(item.id, result.record);
      }

      if (result.created) {
        createdAnime += 1;
      } else {
        updatedAnime += 1;
      }
    }

    let importedHistory = 0;
    let skippedHistory = 0;

    for (const item of historyRecords) {
      const watchedAt = toOptionalDate(item.watchedAt);
      const episode = toOptionalNumber(item.episode);
      const historyTitle = toOptionalString(item.animeTitle);

      if (!watchedAt || episode === undefined) {
        skippedHistory += 1;
        continue;
      }

      let anime = typeof item.animeId === 'number' ? animeIdMap.get(item.animeId) : undefined;

      if (!anime && historyTitle) {
        anime = animeTitleMap.get(historyTitle) || await findAnimeByExactTitle(connection, historyTitle) || undefined;
        if (anime) {
          animeTitleMap.set(anime.title.trim(), anime);
        }
      }

      if (!anime) {
        skippedHistory += 1;
        continue;
      }

      const existingRows = await connection.query<ExistingHistoryRow[]>(
        'SELECT id FROM watch_history WHERE animeId = ? AND episode = ? AND watchedAt = ? LIMIT 1',
        [anime.id, episode, watchedAt]
      );
      const [existing] = existingRows;

      if (existing.length > 0) {
        skippedHistory += 1;
        continue;
      }

      await connection.query<ResultSetHeader>(
        'INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES (?, ?, ?, ?)',
        [anime.id, anime.title, episode, watchedAt]
      );
      importedHistory += 1;
    }

    await connection.commit();

    return apiSuccess({
      success: true,
      anime: {
        created: createdAnime,
        updated: updatedAnime,
      },
      watchHistory: {
        imported: importedHistory,
        skipped: skippedHistory,
      },
    });
  } catch (error: unknown) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : '导入失败';
    return apiError(message, 500);
  } finally {
    connection.release();
  }
}