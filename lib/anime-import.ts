import 'server-only';
import { getRawDb } from './db';
import { clearAllCoverImages } from './cover-image';
import type { AnimeStatus, CreateAnimeDTO } from './anime';
import { nowISO } from './date-utils';

const VALID_STATUSES = new Set<AnimeStatus>(['watching', 'completed', 'dropped', 'plan_to_watch']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ImportAnimeItem {
  id?: number | string;
  title: string;
  [key: string]: unknown;
}

export interface ImportHistoryItem {
  id?: number | string;
  animeId?: number | string;
  animeTitle?: string;
  episode?: number | string;
  watchedAt?: string;
}

export interface ImportPayload {
  records?: ImportAnimeItem[];
  anime?: { records?: ImportAnimeItem[] };
  watchHistory?: { records?: ImportHistoryItem[] };
}

export interface ImportResult {
  success: true;
  mode: 'replace';
  anime: { replaced: number };
  watchHistory: { replaced: number; skipped: number };
}

type NormalizedAnime = {
  sourceId?: number | string;
  payload: CreateAnimeDTO;
  createdAt: string;
  updatedAt: string;
};

function optionalString(value: unknown, maxLength: number, field: string): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${field} 必须是字符串`);
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) throw new Error(`${field} 不能超过 ${maxLength} 个字符`);
  return normalized;
}

function optionalNumber(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} 必须是有效数字`);
  if (options.integer && !Number.isInteger(parsed)) throw new Error(`${field} 必须是整数`);
  if (options.min !== undefined && parsed < options.min) throw new Error(`${field} 不能小于 ${options.min}`);
  if (options.max !== undefined && parsed > options.max) throw new Error(`${field} 不能大于 ${options.max}`);
  return parsed;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  throw new Error(`${field} 必须是布尔值`);
}

function optionalDate(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value, 10, field);
  if (!normalized) return undefined;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (!DATE_PATTERN.test(normalized) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${field} 必须是 YYYY-MM-DD 格式`);
  }
  return normalized;
}

function stringArray(value: unknown, field: string): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${field} 必须是字符串数组`);
  if (value.length > 100) throw new Error(`${field} 最多包含 100 项`);
  const result = Array.from(new Set(value.map((item) => {
    if (typeof item !== 'string') throw new Error(`${field} 只能包含字符串`);
    const normalized = item.trim();
    if (normalized.length > 200) throw new Error(`${field} 的单项不能超过 200 个字符`);
    return normalized;
  }).filter(Boolean)));
  return result.length > 0 ? result : undefined;
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : value.trim();
}

function normalizeAnime(item: ImportAnimeItem, index: number): NormalizedAnime {
  if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 部番剧格式无效`);
  const title = optionalString(item.title, 500, `第 ${index + 1} 部番剧的标题`);
  if (!title) throw new Error(`第 ${index + 1} 部番剧缺少标题`);

  const statusValue = optionalString(item.status, 30, `${title} 的状态`) || 'plan_to_watch';
  if (!VALID_STATUSES.has(statusValue as AnimeStatus)) throw new Error(`${title} 的状态无效：${statusValue}`);

  const now = nowISO();
  const importedCoverUrl = optionalString(item.coverUrl, 2000, `${title} 的封面地址`);
  const portableCoverUrl = importedCoverUrl && /^https?:\/\//i.test(importedCoverUrl)
    ? importedCoverUrl
    : undefined;
  return {
    sourceId: item.id,
    payload: {
      title,
      originalTitle: optionalString(item.originalTitle, 500, `${title} 的原标题`),
      coverUrl: portableCoverUrl,
      localCoverUrl: undefined,
      status: statusValue as AnimeStatus,
      score: optionalNumber(item.score, `${title} 的评分`, { min: 0, max: 10 }),
      progress: optionalNumber(item.progress, `${title} 的进度`, { min: 0, integer: true }) ?? 0,
      totalEpisodes: optionalNumber(item.totalEpisodes, `${title} 的总集数`, { min: 0, max: 9999, integer: true }),
      durationMinutes: optionalNumber(item.durationMinutes, `${title} 的时长`, { min: 0, max: 9999, integer: true }),
      notes: optionalString(item.notes, 5000, `${title} 的备注`),
      tags: stringArray(item.tags, `${title} 的标签`),
      cast: stringArray(item.cast, `${title} 的声优`),
      castAliases: stringArray(item.castAliases, `${title} 的声优别名`),
      summary: optionalString(item.summary, 10000, `${title} 的简介`),
      startDate: optionalDate(item.startDate, `${title} 的开始日期`),
      endDate: optionalDate(item.endDate, `${title} 的结束日期`),
      premiereDate: optionalDate(item.premiereDate, `${title} 的首播日期`),
      isFinished: optionalBoolean(item.isFinished, `${title} 的完结状态`),
    },
    createdAt: normalizeTimestamp(item.createdAt, now),
    updatedAt: normalizeTimestamp(item.updatedAt, now),
  };
}

function sourceKey(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

/**
 * 用导入文件完整替换番剧和观看历史。
 * 校验在事务开始前完成；删除与写入在同一个事务内，任一步失败都会回滚。
 */
export async function importAnimeData(body: ImportPayload): Promise<ImportResult> {
  const animeRecords = Array.isArray(body.anime?.records)
    ? body.anime.records
    : (Array.isArray(body.records) ? body.records : null);
  const historyRecords = Array.isArray(body.watchHistory?.records) ? body.watchHistory.records : [];

  if (!animeRecords || animeRecords.length === 0) {
    throw new Error('覆盖导入必须包含至少一部番剧');
  }
  if (animeRecords.length > 10000 || historyRecords.length > 100000) {
    throw new Error('导入文件过大：番剧最多 10000 部，历史最多 100000 条');
  }

  const normalizedAnime = animeRecords.map(normalizeAnime);
  const seenSourceIds = new Set<string>();
  for (const item of normalizedAnime) {
    const key = sourceKey(item.sourceId);
    if (!key) continue;
    if (seenSourceIds.has(key)) throw new Error(`导入文件包含重复的番剧 ID：${key}`);
    seenSourceIds.add(key);
  }

  const db = getRawDb();
  let skippedHistory = 0;
  let importedHistory = 0;

  const replaceTransaction = db.transaction(() => {
    db.prepare('DELETE FROM watch_history').run();
    db.prepare('DELETE FROM anime').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('anime', 'watch_history')").run();

    const insertWithId = db.prepare(`
      INSERT INTO anime (id, title, original_title, coverUrl, localCoverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, end_date, premiere_date, cast, cast_aliases, isFinished, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertWithoutId = db.prepare(`
      INSERT INTO anime (title, original_title, coverUrl, localCoverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, end_date, premiere_date, cast, cast_aliases, isFinished, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const sourceIdMap = new Map<string, number>();
    const titleMap = new Map<string, number[]>();

    const ordered = [...normalizedAnime].sort((left, right) => {
      const leftHasNumericId = Number.isInteger(left.sourceId) && Number(left.sourceId) > 0;
      const rightHasNumericId = Number.isInteger(right.sourceId) && Number(right.sourceId) > 0;
      return Number(rightHasNumericId) - Number(leftHasNumericId);
    });

    for (const item of ordered) {
      const p = item.payload;
      const values = [
        p.title, p.originalTitle || null, p.coverUrl || null, p.localCoverUrl || null, p.status, p.score ?? null,
        p.progress, p.totalEpisodes ?? null, p.durationMinutes ?? null, p.notes || null,
        JSON.stringify(p.tags || []), p.summary || null, p.startDate || null, p.endDate || null,
        p.premiereDate || null, JSON.stringify(p.cast || []), JSON.stringify(p.castAliases || []),
        p.isFinished == null ? null : (p.isFinished ? 1 : 0), item.createdAt, item.updatedAt,
      ];
      const numericId = Number.isInteger(item.sourceId) && Number(item.sourceId) > 0 ? Number(item.sourceId) : undefined;
      const result = numericId
        ? insertWithId.run(numericId, ...values)
        : insertWithoutId.run(...values);
      const newId = numericId ?? Number(result.lastInsertRowid);
      const key = sourceKey(item.sourceId);
      if (key) sourceIdMap.set(key, newId);
      const titleIds = titleMap.get(p.title) || [];
      titleIds.push(newId);
      titleMap.set(p.title, titleIds);
    }

    const insertHistory = db.prepare(
      'INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES (?, ?, ?, ?)',
    );
    const animeTitleById = db.prepare('SELECT title FROM anime WHERE id = ?');

    for (let index = 0; index < historyRecords.length; index++) {
      const item = historyRecords[index];
      if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 条观看历史格式无效`);
      const episode = optionalNumber(item.episode, `第 ${index + 1} 条历史的集数`, { min: 1, integer: true });
      const watchedAt = optionalString(item.watchedAt, 100, `第 ${index + 1} 条历史的时间`);
      if (!episode || !watchedAt || Number.isNaN(new Date(watchedAt).getTime())) {
        throw new Error(`第 ${index + 1} 条观看历史缺少有效的集数或时间`);
      }

      let animeId = sourceIdMap.get(sourceKey(item.animeId) || '');
      if (!animeId && typeof item.animeTitle === 'string') {
        const matches = titleMap.get(item.animeTitle.trim()) || [];
        if (matches.length === 1) animeId = matches[0];
      }
      if (!animeId) {
        skippedHistory++;
        continue;
      }

      const row = animeTitleById.get(animeId) as { title: string } | undefined;
      if (!row) {
        skippedHistory++;
        continue;
      }
      insertHistory.run(animeId, row.title, episode, new Date(watchedAt).toISOString());
      importedHistory++;
    }
  });

  replaceTransaction();
  await clearAllCoverImages();
  return {
    success: true,
    mode: 'replace',
    anime: { replaced: normalizedAnime.length },
    watchHistory: { replaced: importedHistory, skipped: skippedHistory },
  };
}
