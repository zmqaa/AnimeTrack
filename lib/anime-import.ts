import { getRawDb } from './db';
import type { AnimeStatus, CreateAnimeDTO } from './anime';
import { nowISO } from './date-utils';
import {
  toOptionalString, toOptionalNumber, toOptionalBoolean, toStringArray,
} from './ai-validation';

// --- Type helpers ---

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

// --- Interfaces ---

interface AnimeLookupRow { id: number; title: string; }
interface ExistingHistoryRow { animeId: number; episode: number; watchedAt: string; }
interface ResolvedAnimeRecord { id: number; title: string; }

export interface ImportAnimeItem {
  id?: number | string;
  title: string;
  [key: string]: unknown;
}

export interface ImportHistoryItem {
  id?: number | string;
  animeId?: number | string;
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

function findAnimeByTitleInDb(db: ReturnType<typeof getRawDb>, title: string): ResolvedAnimeRecord | null {
  const row = db.prepare(
    'SELECT id, title FROM anime WHERE title = ? OR original_title = ? ORDER BY id DESC LIMIT 1'
  ).get(title, title) as AnimeLookupRow | undefined;
  return row ? { id: row.id, title: row.title } : null;
}

export async function importAnimeData(body: ImportPayload): Promise<ImportResult> {
  const db = getRawDb();

  const animeRecords = Array.isArray(body.anime?.records) ? body.anime.records
    : (Array.isArray(body.records) ? body.records : []);
  const historyRecords = Array.isArray(body.watchHistory?.records) ? body.watchHistory.records : [];

  if (animeRecords.length === 0 && historyRecords.length === 0) {
    throw new Error('JSON 中没有可导入的数据');
  }

  let createdAnime = 0;
  let updatedAnime = 0;
  let importedHistory = 0;
  let skippedHistory = 0;

  const importTransaction = db.transaction(() => {
    const animeIdMap = new Map<number | string, ResolvedAnimeRecord>();
    const animeTitleMap = new Map<string, ResolvedAnimeRecord>();

    // ── Batch process anime records ──
    const validItems: Array<{
      originalId?: number | string;
      payload: CreateAnimeDTO;
      createdAt?: string;
      updatedAt?: string;
    }> = [];
    for (const item of animeRecords) {
      if (!item || typeof item.title !== 'string' || !item.title.trim()) continue;
      validItems.push({
        originalId: item.id,
        payload: normalizeAnimePayload(item as ImportAnimeItem),
        createdAt: toOptionalString(item.createdAt),
        updatedAt: toOptionalString(item.updatedAt),
      });
    }

    if (validItems.length > 0) {
      // 1) Batch lookup existing title → id mapping
      const titles = validItems.map((v) => v.payload.title);
      const placeholders = titles.map(() => '?').join(',');
      const existingRows = db.prepare(
        `SELECT id, title FROM anime WHERE title IN (${placeholders}) OR original_title IN (${placeholders})`
      ).all(...titles, ...titles) as AnimeLookupRow[];

      const existingByTitle = new Map<string, ResolvedAnimeRecord>();
      for (const row of existingRows) {
        existingByTitle.set(row.title, { id: row.id, title: row.title });
      }

      // 2) Group: create vs update
      const toCreate: Array<{ originalId?: number | string; payload: CreateAnimeDTO; createdAt?: string; updatedAt?: string }> = [];
      const toUpdate: Array<{ id: number; originalId?: number | string; payload: CreateAnimeDTO; updatedAt?: string }> = [];

      for (const item of validItems) {
        const existing = existingByTitle.get(item.payload.title);
        if (existing) {
          toUpdate.push({ id: existing.id, originalId: item.originalId, payload: item.payload, updatedAt: item.updatedAt });
          animeTitleMap.set(existing.title, existing);
          if (item.originalId !== undefined) animeIdMap.set(item.originalId, existing);
        } else {
          toCreate.push(item);
        }
      }

      // 3) Batch INSERT new records
      const now = nowISO();
      if (toCreate.length > 0) {
        const columns = 'title, original_title, coverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, end_date, premiere_date, cast, cast_aliases, isFinished, createdAt, updatedAt';
        const rowPlaceholders = toCreate.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const insertStmt = db.prepare(
          `INSERT INTO anime (${columns}) VALUES ${rowPlaceholders}`
        );
        const params: unknown[] = [];
        for (const { payload, createdAt, updatedAt } of toCreate) {
          params.push(
            payload.title, payload.originalTitle || null, payload.coverUrl || null,
            payload.status, payload.score ?? null, payload.progress,
            payload.totalEpisodes ?? null, payload.durationMinutes ?? null,
            payload.notes || null, JSON.stringify(payload.tags || []),
            payload.summary || null, payload.startDate || null,
            payload.endDate || null, payload.premiereDate || null,
            JSON.stringify(payload.cast || []), JSON.stringify(payload.castAliases || []),
            payload.isFinished != null ? (payload.isFinished ? 1 : 0) : null,
            createdAt || now,
            updatedAt || now,
          );
        }
        const result = insertStmt.run(...params);
        // lastInsertRowid 是多行 INSERT 最后一行的 ID，需要倒推第一行的 ID
        let nextId = Number(result.lastInsertRowid) - toCreate.length + 1;
        for (const item of toCreate) {
          const record = { id: nextId++, title: item.payload.title };
          animeTitleMap.set(record.title, record);
          if (item.originalId !== undefined) animeIdMap.set(item.originalId, record);
          createdAnime++;
        }
      }

      // 4) Batch UPDATE existing records
      for (const { id, payload, updatedAt } of toUpdate) {
        db.prepare(
          `UPDATE anime SET title=?, original_title=?, coverUrl=?, status=?, score=?, progress=?, totalEpisodes=?, durationMinutes=?, notes=?, tags=?, summary=?, start_date=?, end_date=?, premiere_date=?, cast=?, cast_aliases=?, isFinished=?, updatedAt=? WHERE id=?`
        ).run(
          payload.title, payload.originalTitle || null, payload.coverUrl || null,
          payload.status, payload.score ?? null, payload.progress,
          payload.totalEpisodes ?? null, payload.durationMinutes ?? null,
          payload.notes || null, JSON.stringify(payload.tags || []),
          payload.summary || null, payload.startDate || null,
          payload.endDate || null, payload.premiereDate || null,
          JSON.stringify(payload.cast || []), JSON.stringify(payload.castAliases || []),
          payload.isFinished != null ? (payload.isFinished ? 1 : 0) : null,
          updatedAt || now, id
        );
        updatedAnime++;
      }
    }

    // ── Batch process history records ──
    const validHistoryItems: Array<{ anime: ResolvedAnimeRecord; episode: number; watchedAt: Date }> = [];

    for (const item of historyRecords) {
      const watchedAt = toOptionalDate(item.watchedAt);
      const episode = toOptionalNumber(item.episode);
      const historyTitle = toOptionalString(item.animeTitle);
      if (!watchedAt || episode === undefined) { skippedHistory++; continue; }

      let anime = item.animeId != null ? animeIdMap.get(item.animeId) : undefined;
      if (!anime && historyTitle) {
        anime = animeTitleMap.get(historyTitle);
        if (!anime) {
          anime = findAnimeByTitleInDb(db, historyTitle) || undefined;
          if (anime) animeTitleMap.set(anime.title.trim(), anime);
        }
      }
      if (!anime) { skippedHistory++; continue; }

      validHistoryItems.push({ anime, episode, watchedAt });
    }

    if (validHistoryItems.length > 0) {
      // Batch dedup: find all existing (animeId, episode, watchedAt) combos
      const dupConditions = validHistoryItems.map(() => '(animeId = ? AND episode = ? AND watchedAt = ?)');
      const dupParams: unknown[] = [];
      for (const item of validHistoryItems) {
        dupParams.push(item.anime.id, item.episode, item.watchedAt.toISOString());
      }
      const dupRows = db.prepare(
        `SELECT animeId, episode, watchedAt FROM watch_history WHERE ${dupConditions.join(' OR ')}`
      ).all(...dupParams) as ExistingHistoryRow[];

      const existingKeys = new Set(
        dupRows.map((r) => `${r.animeId}|${r.episode}|${r.watchedAt}`)
      );

      const toInsert = validHistoryItems.filter((item) =>
        !existingKeys.has(`${item.anime.id}|${item.episode}|${item.watchedAt.toISOString()}`)
      );

      if (toInsert.length > 0) {
        const rowPlaceholders = toInsert.map(() => '(?, ?, ?, ?)').join(', ');
        const insertParams: unknown[] = [];
        for (const item of toInsert) {
          insertParams.push(item.anime.id, item.anime.title, item.episode, item.watchedAt.toISOString());
        }
        db.prepare(
          `INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES ${rowPlaceholders}`
        ).run(...insertParams);
        importedHistory = toInsert.length;
      }
      skippedHistory += validHistoryItems.length - toInsert.length;
    }
  });

  importTransaction();

  return {
    success: true,
    anime: { created: createdAnime, updated: updatedAnime },
    watchHistory: { imported: importedHistory, skipped: skippedHistory },
  };
}
