import { type RowDataPacket, type ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { pool } from './db';
import type { AnimeStatus, CreateAnimeDTO } from './anime';
import {
  toOptionalString, toOptionalNumber, toOptionalBoolean, toStringArray,
} from './ai-validation';

// --- Type helpers (import-specific) ---

function toOptionalDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

// --- Payload normalization ---

export function normalizeAnimePayload(item: Record<string, unknown> & { title: string }): CreateAnimeDTO {
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

// --- DB helpers (connection-based for transactions) ---

interface AnimeLookupRow extends RowDataPacket { id: number; title: string; }
interface ExistingHistoryRow extends RowDataPacket { id: number; animeId: number; episode: number; watchedAt: Date; }
interface ResolvedAnimeRecord { id: number; title: string; }

async function findAnimeByTitleInConn(connection: PoolConnection, title: string): Promise<ResolvedAnimeRecord | null> {
  const [rows] = await connection.query<AnimeLookupRow[]>(
    'SELECT id, title FROM anime WHERE title = ? OR original_title = ? ORDER BY id DESC LIMIT 1',
    [title, title]
  );
  return rows[0] ? { id: rows[0].id, title: rows[0].title } : null;
}

// --- Public API ---

export interface ImportAnimeItem {
  id?: number;
  title: string;
  [key: string]: unknown;
}

export interface ImportHistoryItem {
  id?: number;
  animeId?: number;
  animeTitle?: string;
  episode?: number;
  watchedAt?: string;
}

export interface ImportPayload {
  records?: ImportAnimeItem[];
  anime?: { records?: ImportAnimeItem[] };
  watchHistory?: { records?: ImportHistoryItem[] };
}

export interface ImportResult {
  success: boolean;
  anime: { created: number; updated: number };
  watchHistory: { imported: number; skipped: number };
}

export async function importAnimeData(body: ImportPayload): Promise<ImportResult> {
  const connection = await pool.getConnection();
  try {
    const animeRecords = Array.isArray(body.anime?.records) ? body.anime.records
      : (Array.isArray(body.records) ? body.records : []);
    const historyRecords = Array.isArray(body.watchHistory?.records) ? body.watchHistory.records : [];

    if (animeRecords.length === 0 && historyRecords.length === 0) {
      throw new Error('JSON 中没有可导入的数据');
    }

    await connection.beginTransaction();

    const animeIdMap = new Map<number, ResolvedAnimeRecord>();
    const animeTitleMap = new Map<string, ResolvedAnimeRecord>();

    // ── 批量处理 anime 记录 ──
    const validItems: Array<{ originalId?: number; payload: CreateAnimeDTO }> = [];
    for (const item of animeRecords) {
      if (!item || typeof item.title !== 'string' || !item.title.trim()) continue;
      validItems.push({
        originalId: typeof item.id === 'number' ? item.id : undefined,
        payload: normalizeAnimePayload(item as ImportAnimeItem),
      });
    }

    let createdAnime = 0, updatedAnime = 0;
    if (validItems.length > 0) {
      // 1) 批量查询已存在的 title → id 映射
      const titles = validItems.map((v) => v.payload.title);
      const placeholders = titles.map(() => '?').join(',');
      const [existingRows] = await connection.query<AnimeLookupRow[]>(
        `SELECT id, title FROM anime WHERE title IN (${placeholders}) OR original_title IN (${placeholders})`,
        [...titles, ...titles]
      );
      const existingByTitle = new Map<string, ResolvedAnimeRecord>();
      for (const row of existingRows) {
        existingByTitle.set(row.title, { id: row.id, title: row.title });
      }

      // 2) 分组：新建 vs 更新
      const toCreate: Array<{ originalId?: number; payload: CreateAnimeDTO }> = [];
      const toUpdate: Array<{ id: number; originalId?: number; payload: CreateAnimeDTO }> = [];

      for (const item of validItems) {
        const existing = existingByTitle.get(item.payload.title);
        if (existing) {
          toUpdate.push({ id: existing.id, originalId: item.originalId, payload: item.payload });
          animeTitleMap.set(existing.title, existing);
          if (item.originalId !== undefined) animeIdMap.set(item.originalId, existing);
        } else {
          toCreate.push(item);
        }
      }

      // 3) 批量 INSERT 新记录
      if (toCreate.length > 0) {
        const columns = 'title, original_title, coverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, end_date, premiere_date, cast, cast_aliases, isFinished';
        const rowPlaceholders = toCreate.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params: unknown[] = [];
        for (const { payload } of toCreate) {
          params.push(
            payload.title, payload.originalTitle || null, payload.coverUrl || null,
            payload.status, payload.score ?? null, payload.progress,
            payload.totalEpisodes ?? null, payload.durationMinutes ?? null,
            payload.notes || null, JSON.stringify(payload.tags || []),
            payload.summary || null, payload.startDate || null,
            payload.endDate || null, payload.premiereDate || null,
            JSON.stringify(payload.cast || []), JSON.stringify(payload.castAliases || []),
            payload.isFinished != null ? (payload.isFinished ? 1 : 0) : null,
          );
        }
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO anime (${columns}) VALUES ${rowPlaceholders}`,
          params
        );
        // 事务内自增 ID 连续，从 insertId 开始顺序分配
        let nextId = result.insertId;
        for (const item of toCreate) {
          const record = { id: nextId++, title: item.payload.title };
          animeTitleMap.set(record.title, record);
          if (item.originalId !== undefined) animeIdMap.set(item.originalId, record);
          createdAnime++;
        }
      }

      // 4) 批量 UPDATE 已有记录
      for (const { id, payload } of toUpdate) {
        await connection.query(
          `UPDATE anime SET title=?, original_title=?, coverUrl=?, status=?, score=?, progress=?, totalEpisodes=?, durationMinutes=?, notes=?, tags=?, summary=?, start_date=?, end_date=?, premiere_date=?, cast=?, cast_aliases=?, isFinished=? WHERE id=?`,
          [payload.title, payload.originalTitle || null, payload.coverUrl || null,
           payload.status, payload.score ?? null, payload.progress,
           payload.totalEpisodes ?? null, payload.durationMinutes ?? null,
           payload.notes || null, JSON.stringify(payload.tags || []),
           payload.summary || null, payload.startDate || null,
           payload.endDate || null, payload.premiereDate || null,
           JSON.stringify(payload.cast || []), JSON.stringify(payload.castAliases || []),
           payload.isFinished != null ? (payload.isFinished ? 1 : 0) : null, id]
        );
        updatedAnime++;
      }
    }

    // ── 批量处理 history 记录 ──
    let importedHistory = 0, skippedHistory = 0;
    const validHistoryItems: Array<{ anime: ResolvedAnimeRecord; episode: number; watchedAt: Date }> = [];

    for (const item of historyRecords) {
      const watchedAt = toOptionalDate(item.watchedAt);
      const episode = toOptionalNumber(item.episode);
      const historyTitle = toOptionalString(item.animeTitle);
      if (!watchedAt || episode === undefined) { skippedHistory++; continue; }

      let anime = typeof item.animeId === 'number' ? animeIdMap.get(item.animeId) : undefined;
      if (!anime && historyTitle) {
        anime = animeTitleMap.get(historyTitle);
        if (!anime) {
          // 回退到单条查询（标题可能在 import 中不存在）
          anime = await findAnimeByTitleInConn(connection, historyTitle) || undefined;
          if (anime) animeTitleMap.set(anime.title.trim(), anime);
        }
      }
      if (!anime) { skippedHistory++; continue; }

      validHistoryItems.push({ anime, episode, watchedAt });
    }

    if (validHistoryItems.length > 0) {
      // 批量查重：一次性查出所有已存在的 (animeId, episode, watchedAt) 组合
      const dupParams: unknown[] = [];
      const dupConditions = validHistoryItems.map((item) => {
        dupParams.push(item.anime.id, item.episode, item.watchedAt);
        return '(animeId = ? AND episode = ? AND watchedAt = ?)';
      });
      const [dupRows] = await connection.query<ExistingHistoryRow[]>(
        `SELECT animeId, episode, watchedAt FROM watch_history WHERE ${dupConditions.join(' OR ')}`,
        dupParams
      );
      const existingKeys = new Set(
        dupRows.map((r) => `${r.animeId}|${r.episode}|${new Date(r.watchedAt).toISOString()}`)
      );

      // 过滤掉已存在的记录
      const toInsert = validHistoryItems.filter((item) =>
        !existingKeys.has(`${item.anime.id}|${item.episode}|${item.watchedAt.toISOString()}`)
      );

      if (toInsert.length > 0) {
        const rowPlaceholders = toInsert.map(() => '(?, ?, ?, ?)').join(', ');
        const insertParams: unknown[] = [];
        for (const item of toInsert) {
          insertParams.push(item.anime.id, item.anime.title, item.episode, item.watchedAt);
        }
        await connection.query<ResultSetHeader>(
          `INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES ${rowPlaceholders}`,
          insertParams
        );
        importedHistory = toInsert.length;
      }
      skippedHistory += validHistoryItems.length - toInsert.length;
    }

    await connection.commit();
    return { success: true, anime: { created: createdAnime, updated: updatedAnime }, watchHistory: { imported: importedHistory, skipped: skippedHistory } };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
