import 'server-only';
import { getRawDb } from './db';
import { backfillMissingAnimeStartDates } from './anime-start-date';
import { clearAllCoverImages } from './cover-image';
import type { AnimeStatus, CreateAnimeDTO } from './anime';
import type { CreateMangaDTO, MangaPublicationStatus, MangaReadingStatus } from './manga';
import { nowISO } from './date-utils';

const VALID_STATUSES = new Set<AnimeStatus>(['watching', 'completed', 'dropped', 'plan_to_watch']);
const VALID_MANGA_STATUSES = new Set<MangaReadingStatus>([
  'plan_to_read', 'reading', 'caught_up', 'completed', 'paused', 'dropped',
]);
const VALID_MANGA_PUBLICATION_STATUSES = new Set<MangaPublicationStatus>([
  'ongoing', 'completed', 'hiatus', 'unknown',
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportValidationError';
  }
}

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

export interface ImportMangaItem {
  id?: number | string;
  title: string;
  [key: string]: unknown;
}

export interface ImportPayload {
  formatVersion?: number;
  datasets?: unknown;
  selectedDatasets?: unknown;
  records?: ImportAnimeItem[];
  anime?: { records?: ImportAnimeItem[] };
  watchHistory?: { records?: ImportHistoryItem[] };
  manga?: { records?: ImportMangaItem[] };
}

export type ImportDataset = 'anime' | 'manga';

export interface ImportResult {
  success: true;
  mode: 'replace';
  datasets: ImportDataset[];
  anime: { selected: boolean; replaced: number };
  watchHistory: { selected: boolean; replaced: number; skipped: number };
  manga: { selected: boolean; replaced: number };
}

type NormalizedAnime = {
  sourceId?: number | string;
  payload: CreateAnimeDTO;
  episodeNotes: Array<{
    episode: number;
    content: string;
    notedAt: string;
    createdAt: string;
    updatedAt: string;
  }>;
  overallNoteDetails?: {
    notedAt: string;
    createdAt: string;
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
};

type NormalizedManga = {
  sourceId?: number | string;
  payload: CreateMangaDTO;
  createdAt: string;
  updatedAt: string;
};

function optionalString(value: unknown, maxLength: number, field: string): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new ImportValidationError(`${field} 必须是字符串`);
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) throw new ImportValidationError(`${field} 不能超过 ${maxLength} 个字符`);
  return normalized;
}

function optionalNumber(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new ImportValidationError(`${field} 必须是有效数字`);
  if (options.integer && !Number.isInteger(parsed)) throw new ImportValidationError(`${field} 必须是整数`);
  if (options.min !== undefined && parsed < options.min) throw new ImportValidationError(`${field} 不能小于 ${options.min}`);
  if (options.max !== undefined && parsed > options.max) throw new ImportValidationError(`${field} 不能大于 ${options.max}`);
  return parsed;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  throw new ImportValidationError(`${field} 必须是布尔值`);
}

function optionalDate(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value, 10, field);
  if (!normalized) return undefined;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (!DATE_PATTERN.test(normalized) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new ImportValidationError(`${field} 必须是 YYYY-MM-DD 格式`);
  }
  return normalized;
}

function stringArray(value: unknown, field: string): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ImportValidationError(`${field} 必须是字符串数组`);
  if (value.length > 100) throw new ImportValidationError(`${field} 最多包含 100 项`);
  const result = Array.from(new Set(value.map((item) => {
    if (typeof item !== 'string') throw new ImportValidationError(`${field} 只能包含字符串`);
    const normalized = item.trim();
    if (normalized.length > 200) throw new ImportValidationError(`${field} 的单项不能超过 200 个字符`);
    return normalized;
  }).filter(Boolean)));
  return result.length > 0 ? result : undefined;
}

function normalizeTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : value.trim();
}

function normalizeNotes(
  value: unknown,
  title: string,
  fallbackTimestamp: string,
): {
  overallNote?: string;
  overallNoteDetails?: NormalizedAnime['overallNoteDetails'];
  episodeNotes: NormalizedAnime['episodeNotes'];
} {
  if (value === null || value === undefined || value === '') {
    return { episodeNotes: [] };
  }
  if (typeof value === 'string') {
    return {
      overallNote: optionalString(value, 5000, `${title} 的总备注`),
      episodeNotes: [],
    };
  }
  if (!Array.isArray(value)) {
    throw new ImportValidationError(`${title} 的备注必须是字符串或备注数组`);
  }
  if (value.length > 10000) throw new ImportValidationError(`${title} 的备注最多包含 10000 条`);

  let overallNote: string | undefined;
  let overallNoteDetails: NormalizedAnime['overallNoteDetails'];
  const episodeNotes: NormalizedAnime['episodeNotes'] = [];
  for (let index = 0; index < value.length; index++) {
    const note = value[index];
    if (!note || typeof note !== 'object') {
      throw new ImportValidationError(`${title} 的第 ${index + 1} 条备注格式无效`);
    }
    const record = note as Record<string, unknown>;
    const content = optionalString(record.content, 5000, `${title} 的第 ${index + 1} 条备注`);
    if (!content) throw new ImportValidationError(`${title} 的第 ${index + 1} 条备注内容为空`);
    const episode = optionalNumber(record.episode, `${title} 的第 ${index + 1} 条备注集数`, {
      min: 1,
      max: 9999,
      integer: true,
    });
    if (episode === undefined) {
      if (overallNote !== undefined) throw new ImportValidationError(`${title} 只能包含一条总备注`);
      overallNote = content;
      overallNoteDetails = {
        notedAt: optionalDate(record.notedAt, `${title} 的总备注日期`) || fallbackTimestamp.slice(0, 10),
        createdAt: normalizeTimestamp(record.createdAt, fallbackTimestamp),
        updatedAt: normalizeTimestamp(record.updatedAt, fallbackTimestamp),
      };
      continue;
    }
    const notedAt = optionalDate(record.notedAt, `${title} 的第 ${index + 1} 条备注日期`)
      || fallbackTimestamp.slice(0, 10);
    episodeNotes.push({
      episode,
      content,
      notedAt,
      createdAt: normalizeTimestamp(record.createdAt, fallbackTimestamp),
      updatedAt: normalizeTimestamp(record.updatedAt, fallbackTimestamp),
    });
  }
  return { overallNote, overallNoteDetails, episodeNotes };
}

function normalizeAnime(item: ImportAnimeItem, index: number): NormalizedAnime {
  if (!item || typeof item !== 'object') throw new ImportValidationError(`第 ${index + 1} 部番剧格式无效`);
  const title = optionalString(item.title, 500, `第 ${index + 1} 部番剧的标题`);
  if (!title) throw new ImportValidationError(`第 ${index + 1} 部番剧缺少标题`);

  const statusValue = optionalString(item.status, 30, `${title} 的状态`) || 'plan_to_watch';
  if (!VALID_STATUSES.has(statusValue as AnimeStatus)) throw new ImportValidationError(`${title} 的状态无效：${statusValue}`);

  const now = nowISO();
  const normalizedNotes = normalizeNotes(item.notes, title, now);
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
      notes: normalizedNotes.overallNote,
      tags: stringArray(item.tags, `${title} 的标签`),
      cast: stringArray(item.cast, `${title} 的声优`),
      castAliases: stringArray(item.castAliases, `${title} 的声优别名`),
      summary: optionalString(item.summary, 10000, `${title} 的简介`),
      startDate: optionalDate(item.startDate, `${title} 的开始日期`),
      startDateSource: item.startDateSource === 'history' ? 'history' : undefined,
      endDate: optionalDate(item.endDate, `${title} 的结束日期`),
      premiereDate: optionalDate(item.premiereDate, `${title} 的首播日期`),
      isFinished: optionalBoolean(item.isFinished, `${title} 的完结状态`),
    },
    episodeNotes: normalizedNotes.episodeNotes,
    overallNoteDetails: normalizedNotes.overallNoteDetails,
    createdAt: normalizeTimestamp(item.createdAt, now),
    updatedAt: normalizeTimestamp(item.updatedAt, now),
  };
}

function normalizeManga(item: ImportMangaItem, index: number): NormalizedManga {
  if (!item || typeof item !== 'object') throw new ImportValidationError(`第 ${index + 1} 部漫画格式无效`);
  const title = optionalString(item.title, 500, `第 ${index + 1} 部漫画的标题`);
  if (!title) throw new ImportValidationError(`第 ${index + 1} 部漫画缺少标题`);
  const status = (optionalString(item.status, 30, `${title} 的阅读状态`) || 'plan_to_read') as MangaReadingStatus;
  if (!VALID_MANGA_STATUSES.has(status)) throw new ImportValidationError(`${title} 的阅读状态无效：${status}`);
  const publicationStatus = (optionalString(item.publicationStatus, 30, `${title} 的连载状态`) || 'unknown') as MangaPublicationStatus;
  if (!VALID_MANGA_PUBLICATION_STATUSES.has(publicationStatus)) {
    throw new ImportValidationError(`${title} 的连载状态无效：${publicationStatus}`);
  }
  const now = nowISO();
  const importedCoverUrl = optionalString(item.coverUrl, 2000, `${title} 的封面地址`);
  return {
    sourceId: item.id,
    payload: {
      bangumiId: optionalNumber(item.bangumiId, `${title} 的 Bangumi ID`, { min: 1, integer: true }),
      title,
      originalTitle: optionalString(item.originalTitle, 500, `${title} 的原名`),
      aliases: stringArray(item.aliases, `${title} 的别名`) || [],
      coverUrl: importedCoverUrl && /^https?:\/\//i.test(importedCoverUrl) ? importedCoverUrl : undefined,
      status,
      publicationStatus,
      score: optionalNumber(item.score, `${title} 的评分`, { min: 0, max: 10 }),
      currentVolume: optionalString(item.currentVolume, 100, `${title} 的当前卷`),
      currentChapter: optionalString(item.currentChapter, 100, `${title} 的当前话`),
      totalVolumes: optionalNumber(item.totalVolumes, `${title} 的参考卷数`, { min: 0, max: 9999, integer: true }),
      totalChapters: optionalNumber(item.totalChapters, `${title} 的参考话数`, { min: 0, max: 999999, integer: true }),
      notes: optionalString(item.notes, 10000, `${title} 的笔记`),
      tags: stringArray(item.tags, `${title} 的标签`) || [],
      summary: optionalString(item.summary, 10000, `${title} 的简介`),
      authors: stringArray(item.authors, `${title} 的作者`) || [],
      illustrators: stringArray(item.illustrators, `${title} 的作画`) || [],
      publishers: stringArray(item.publishers, `${title} 的出版社`) || [],
      serializations: stringArray(item.serializations, `${title} 的连载平台`) || [],
      startDate: optionalDate(item.startDate, `${title} 的开始日期`),
      endDate: optionalDate(item.endDate, `${title} 的读完日期`),
      releaseDate: optionalDate(item.releaseDate, `${title} 的发行日期`),
    },
    createdAt: normalizeTimestamp(item.createdAt, now),
    updatedAt: normalizeTimestamp(item.updatedAt, now),
  };
}

function sourceKey(value: number | string | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}

function parseDatasetList(value: unknown): ImportDataset[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(
    (dataset): dataset is ImportDataset => dataset === 'anime' || dataset === 'manga',
  )));
}

export function getAvailableImportDatasets(body: ImportPayload): ImportDataset[] {
  const declared = parseDatasetList(body.datasets);
  if (declared.length > 0) return declared;

  const datasets: ImportDataset[] = [];
  if (Array.isArray(body.records) || Object.prototype.hasOwnProperty.call(body, 'anime')
    || Object.prototype.hasOwnProperty.call(body, 'watchHistory')) {
    datasets.push('anime');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'manga')) datasets.push('manga');
  return datasets;
}

/**
 * 只替换用户选中的数据组。动漫组始终包含番剧、备注和观看历史，漫画组独立。
 * 校验在事务开始前完成；删除与写入在同一个事务内，任一步失败都会回滚。
 */
export async function importAnimeData(body: ImportPayload): Promise<ImportResult> {
  const availableDatasets = getAvailableImportDatasets(body);
  const requestedDatasets = parseDatasetList(body.selectedDatasets);
  const selectedDatasets = Array.isArray(body.selectedDatasets) ? requestedDatasets : availableDatasets;
  if (selectedDatasets.length === 0) throw new ImportValidationError('请至少选择一类要导入的数据');
  for (const dataset of selectedDatasets) {
    if (!availableDatasets.includes(dataset)) throw new ImportValidationError('导入文件不包含所选的数据');
  }

  const importsAnime = selectedDatasets.includes('anime');
  const importsManga = selectedDatasets.includes('manga');
  const animeRecords = Array.isArray(body.anime?.records)
    ? body.anime.records
    : (Array.isArray(body.records) ? body.records : []);
  const historyRecords = Array.isArray(body.watchHistory?.records) ? body.watchHistory.records : [];
  const mangaRecords = Array.isArray(body.manga?.records) ? body.manga.records : [];

  if ((importsAnime && (animeRecords.length > 10000 || historyRecords.length > 100000))
    || (importsManga && mangaRecords.length > 10000)) {
    throw new ImportValidationError('导入文件过大：番剧和漫画各最多 10000 部，历史最多 100000 条');
  }

  const normalizedAnime = importsAnime ? animeRecords.map(normalizeAnime) : [];
  const normalizedManga = importsManga ? mangaRecords.map(normalizeManga) : [];
  const seenSourceIds = new Set<string>();
  for (const item of normalizedAnime) {
    const key = sourceKey(item.sourceId);
    if (!key) continue;
    if (seenSourceIds.has(key)) throw new ImportValidationError(`导入文件包含重复的番剧 ID：${key}`);
    seenSourceIds.add(key);
  }

  const db = getRawDb();
  let skippedHistory = 0;
  let importedHistory = 0;

  const replaceTransaction = db.transaction(() => {
    if (importsAnime) {
      db.prepare('DELETE FROM watch_history').run();
      db.prepare('DELETE FROM anime').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('anime', 'anime_notes', 'watch_history')").run();
    }
    if (importsManga) {
      db.prepare('DELETE FROM manga').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'manga'").run();
    }

    const insertWithId = db.prepare(`
      INSERT INTO anime (id, title, original_title, coverUrl, localCoverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, start_date_source, end_date, premiere_date, cast, cast_aliases, isFinished, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertWithoutId = db.prepare(`
      INSERT INTO anime (title, original_title, coverUrl, localCoverUrl, status, score, progress, totalEpisodes, durationMinutes, notes, tags, summary, start_date, start_date_source, end_date, premiere_date, cast, cast_aliases, isFinished, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const sourceIdMap = new Map<string, number>();
    const importedAnimeIds = new Map<NormalizedAnime, number>();
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
        JSON.stringify(p.tags || []), p.summary || null, p.startDate || null, p.startDateSource || null, p.endDate || null,
        p.premiereDate || null, JSON.stringify(p.cast || []), JSON.stringify(p.castAliases || []),
        p.isFinished == null ? null : (p.isFinished ? 1 : 0), item.createdAt, item.updatedAt,
      ];
      const numericId = Number.isInteger(item.sourceId) && Number(item.sourceId) > 0 ? Number(item.sourceId) : undefined;
      const result = numericId
        ? insertWithId.run(numericId, ...values)
        : insertWithoutId.run(...values);
      const newId = numericId ?? Number(result.lastInsertRowid);
      importedAnimeIds.set(item, newId);
      const key = sourceKey(item.sourceId);
      if (key) sourceIdMap.set(key, newId);
      const titleIds = titleMap.get(p.title) || [];
      titleIds.push(newId);
      titleMap.set(p.title, titleIds);
    }

    const insertHistory = db.prepare(
      'INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES (?, ?, ?, ?)',
    );
    const insertNoteWithoutId = db.prepare(`
      INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const updateOverallNoteMetadata = db.prepare(`
      UPDATE anime_notes
      SET notedAt = ?, createdAt = ?, updatedAt = ?
      WHERE animeId = ? AND episode IS NULL
    `);
    const animeTitleById = db.prepare('SELECT title FROM anime WHERE id = ?');

    for (let index = 0; importsAnime && index < historyRecords.length; index++) {
      const item = historyRecords[index];
      if (!item || typeof item !== 'object') throw new ImportValidationError(`第 ${index + 1} 条观看历史格式无效`);
      const episode = optionalNumber(item.episode, `第 ${index + 1} 条历史的集数`, { min: 1, integer: true });
      const watchedAt = optionalString(item.watchedAt, 100, `第 ${index + 1} 条历史的时间`);
      if (!episode || !watchedAt || Number.isNaN(new Date(watchedAt).getTime())) {
        throw new ImportValidationError(`第 ${index + 1} 条观看历史缺少有效的集数或时间`);
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

    if (importsAnime) backfillMissingAnimeStartDates(db);

    for (const item of ordered) {
      const animeId = importedAnimeIds.get(item);
      if (!animeId) continue;
      if (item.overallNoteDetails) {
        updateOverallNoteMetadata.run(
          item.overallNoteDetails.notedAt,
          item.overallNoteDetails.createdAt,
          item.overallNoteDetails.updatedAt,
          animeId,
        );
      }
      for (const note of item.episodeNotes) {
        insertNoteWithoutId.run(
          animeId,
          note.episode,
          note.content,
          note.notedAt,
          note.createdAt,
          note.updatedAt,
        );
      }
    }

    const insertMangaWithId = db.prepare(`
      INSERT INTO manga (
        id, bangumi_id, title, original_title, aliases, coverUrl, status, publication_status,
        score, current_volume, current_chapter, total_volumes, total_chapters, notes,
        tags, summary, authors, illustrators, publishers, serializations,
        start_date, end_date, release_date, createdAt, updatedAt
      ) VALUES (${Array.from({ length: 25 }, () => '?').join(', ')})
    `);
    const insertMangaWithoutId = db.prepare(`
      INSERT INTO manga (
        bangumi_id, title, original_title, aliases, coverUrl, status, publication_status,
        score, current_volume, current_chapter, total_volumes, total_chapters, notes,
        tags, summary, authors, illustrators, publishers, serializations,
        start_date, end_date, release_date, createdAt, updatedAt
      ) VALUES (${Array.from({ length: 24 }, () => '?').join(', ')})
    `);
    for (const item of normalizedManga) {
      const p = item.payload;
      const values = [
        p.bangumiId ?? null, p.title, p.originalTitle || null, JSON.stringify(p.aliases || []),
        p.coverUrl || null, p.status, p.publicationStatus, p.score ?? null,
        p.currentVolume || null, p.currentChapter || null, p.totalVolumes ?? null,
        p.totalChapters ?? null, p.notes || null, JSON.stringify(p.tags || []), p.summary || null,
        JSON.stringify(p.authors || []), JSON.stringify(p.illustrators || []),
        JSON.stringify(p.publishers || []), JSON.stringify(p.serializations || []),
        p.startDate || null, p.endDate || null, p.releaseDate || null,
        item.createdAt, item.updatedAt,
      ];
      const numericId = Number.isInteger(item.sourceId) && Number(item.sourceId) > 0
        ? Number(item.sourceId)
        : undefined;
      if (numericId) insertMangaWithId.run(numericId, ...values);
      else insertMangaWithoutId.run(...values);
    }
  });

  replaceTransaction();
  if (importsAnime) await clearAllCoverImages();
  return {
    success: true,
    mode: 'replace',
    datasets: selectedDatasets,
    anime: { selected: importsAnime, replaced: normalizedAnime.length },
    watchHistory: { selected: importsAnime, replaced: importedHistory, skipped: skippedHistory },
    manga: { selected: importsManga, replaced: normalizedManga.length },
  };
}
