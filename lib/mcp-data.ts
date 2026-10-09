import 'server-only';

import { getAnimeListOverview, getAnimeRecord, listAnimeRecordsPaginated, type AnimeRecord } from '@/lib/anime';
import { listAllAnimeNotes, listAnimeNotes } from '@/lib/anime-notes';
import type { AnimeNoteEntry, AnimeStatus } from '@/lib/anime-shared';
import { getDashboardOverview } from '@/lib/dashboard-overview';
import { getAllWatchHistory, getWatchHistoryPaginated, type WatchHistoryRecord } from '@/lib/history';
import { getMangaRecord, listMangaRecords, type MangaRecord } from '@/lib/manga';
import type { MangaPublicationStatus, MangaReadingStatus } from '@/lib/manga-shared';
import { getMcpSourceBaseUrl } from '@/lib/mcp-config';
import { getTimelineOverview } from '@/lib/timeline-overview';
import { getTimelineEntries } from '@/lib/timeline-queries';
import type { TimelineSortBy } from '@/lib/timeline-types';

export const MCP_DEFAULT_PAGE_SIZE = 50;
export const MCP_MAX_PAGE_SIZE = 100;
export const MCP_MAX_SEARCH_RESULTS = 50;

export interface AnimeSearchOptions {
  query?: string;
  status?: AnimeStatus;
  page?: number;
  pageSize?: number;
}

export interface MangaSearchOptions {
  query?: string;
  status?: MangaReadingStatus;
  publicationStatus?: MangaPublicationStatus;
  page?: number;
  pageSize?: number;
}

export interface NoteSearchOptions {
  query?: string;
  animeId?: number;
  limit?: number;
}

export interface McpSearchResult {
  id: string;
  title: string;
  url: string;
}

export interface McpFetchResult {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata?: Record<string, unknown>;
}

interface SearchDocument extends McpFetchResult {
  searchText: string;
}

function safePage(value: number | undefined): number {
  return Math.min(10_000, Math.max(1, Math.floor(Number(value) || 1)));
}

function safePageSize(value: number | undefined): number {
  return Math.min(
    MCP_MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(value) || MCP_DEFAULT_PAGE_SIZE)),
  );
}

function safeLimit(value: number | undefined, fallback = MCP_DEFAULT_PAGE_SIZE): number {
  return Math.min(MCP_MAX_SEARCH_RESULTS, Math.max(1, Math.floor(Number(value) || fallback)));
}

function normalizeSearch(value: string | undefined): string {
  return String(value || '').trim().slice(0, 200);
}

async function listAllAnimeRecords(): Promise<AnimeRecord[]> {
  const records: AnimeRecord[] = [];
  const pageSize = MCP_MAX_PAGE_SIZE;
  let page = 1;

  while (page <= 10_000) {
    const result = await listAnimeRecordsPaginated({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    records.push(...result.records);
    if (page >= result.totalPages || result.records.length === 0) break;
    page += 1;
  }

  return records;
}

function sourceUrl(path: string): string {
  return `${getMcpSourceBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function absoluteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return sourceUrl(value);
  return value;
}

function exposeAnime(record: AnimeRecord): AnimeRecord {
  return {
    ...record,
    coverUrl: absoluteUrl(record.coverUrl),
    localCoverUrl: absoluteUrl(record.localCoverUrl),
    displayCoverUrl: absoluteUrl(record.displayCoverUrl),
    thumbnailCoverUrl: absoluteUrl(record.thumbnailCoverUrl),
  };
}

function exposeManga(record: MangaRecord): MangaRecord {
  return {
    ...record,
    coverUrl: absoluteUrl(record.coverUrl),
    localCoverUrl: absoluteUrl(record.localCoverUrl),
    displayCoverUrl: absoluteUrl(record.displayCoverUrl),
    thumbnailCoverUrl: absoluteUrl(record.thumbnailCoverUrl),
  };
}

function exposeNote(note: AnimeNoteEntry): AnimeNoteEntry {
  return { ...note };
}

function exposeHistory(record: WatchHistoryRecord): WatchHistoryRecord {
  return { ...record };
}

export async function searchAnimeData(options: AnimeSearchOptions = {}) {
  const page = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);
  const result = await listAnimeRecordsPaginated({
    search: normalizeSearch(options.query) || undefined,
    status: options.status,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return {
    ...result,
    records: result.records.map(exposeAnime),
  };
}

export async function getAnimeDetailData(id: number) {
  const record = await getAnimeRecord(id);
  if (!record) return null;

  const history = (await getAllWatchHistory())
    .filter((item) => item.animeId === id)
    .map(exposeHistory);

  return {
    ...exposeAnime(record),
    noteEntries: listAnimeNotes(id).map(exposeNote),
    watchHistory: history,
    sourceUrl: sourceUrl(`/anime/${id}`),
  };
}

export async function searchMangaData(options: MangaSearchOptions = {}) {
  const page = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);
  const records = await listMangaRecords({
    search: normalizeSearch(options.query) || undefined,
    status: options.status,
    publicationStatus: options.publicationStatus,
  });
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const actualPage = Math.min(page, totalPages);
  const offset = (actualPage - 1) * pageSize;

  return {
    records: records.slice(offset, offset + pageSize).map(exposeManga),
    total,
    page: actualPage,
    pageSize,
    totalPages,
  };
}

export async function getMangaDetailData(id: number) {
  const record = await getMangaRecord(id);
  return record
    ? { ...exposeManga(record), sourceUrl: sourceUrl(`/manga/${id}`) }
    : null;
}

export async function getWatchHistoryData(options: {
  page?: number;
  pageSize?: number;
  query?: string;
} = {}) {
  const page = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);
  const result = await getWatchHistoryPaginated(
    page,
    pageSize,
    normalizeSearch(options.query) || undefined,
  );
  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

  return {
    records: result.records.map(exposeHistory),
    total: result.total,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
  };
}

export async function getTimelineData(options: {
  page?: number;
  pageSize?: number;
  query?: string;
  date?: string;
  sortBy?: TimelineSortBy;
} = {}) {
  const page = safePage(options.page);
  const pageSize = safePageSize(options.pageSize);
  const result = await getTimelineEntries({
    page,
    pageSize,
    search: normalizeSearch(options.query) || undefined,
    date: options.date?.trim() || undefined,
    sortBy: options.sortBy || 'newest',
  });

  return {
    ...result,
    records: result.records.map((entry) => ({
      ...entry,
      history: exposeHistory(entry.history),
      anime: entry.anime
        ? {
          ...entry.anime,
          displayCoverUrl: absoluteUrl(entry.anime.displayCoverUrl),
          thumbnailCoverUrl: absoluteUrl(entry.anime.thumbnailCoverUrl),
        }
        : undefined,
    })),
  };
}

export async function searchNotesData(options: NoteSearchOptions = {}) {
  const queryText = normalizeSearch(options.query).toLocaleLowerCase();
  const notes = listAllAnimeNotes();
  const animeRecords = await listAllAnimeRecords();
  const animeById = new Map(animeRecords.map((record) => [record.id, record]));
  const filtered = notes.filter((note) => {
    if (options.animeId && note.animeId !== options.animeId) return false;
    if (!queryText) return true;
    return note.content.toLocaleLowerCase().includes(queryText);
  });
  const limit = safeLimit(options.limit);

  return {
    records: filtered.slice(0, limit).map((note) => ({
      ...exposeNote(note),
      anime: animeById.has(note.animeId) ? exposeAnime(animeById.get(note.animeId)!) : undefined,
      sourceUrl: sourceUrl(`/anime/${note.animeId}`),
    })),
    total: filtered.length,
    limit,
  };
}

export async function getLibraryOverviewData() {
  const [dashboard, animeOverview, timelineOverview, mangaRecords] = await Promise.all([
    getDashboardOverview(),
    getAnimeListOverview(),
    getTimelineOverview(),
    listMangaRecords(),
  ]);

  const mangaByStatus = mangaRecords.reduce<Record<string, number>>((counts, record) => {
    counts[record.status] = (counts[record.status] || 0) + 1;
    return counts;
  }, {});

  return {
    anime: {
      overview: animeOverview,
      count: animeOverview.stats.libraryWorks,
    },
    manga: {
      count: mangaRecords.length,
      byStatus: mangaByStatus,
      records: mangaRecords.map(exposeManga),
    },
    notes: {
      count: listAllAnimeNotes().length,
    },
    watchHistory: {
      count: timelineOverview.stats.totalEpisodes,
    },
    dashboard,
    timeline: timelineOverview,
  };
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function documentFromAnime(record: AnimeRecord): SearchDocument {
  const detail = {
    ...exposeAnime(record),
    sourceUrl: sourceUrl(`/anime/${record.id}`),
  };
  return {
    id: `anime:${record.id}`,
    title: record.title,
    text: jsonText(detail),
    url: sourceUrl(`/anime/${record.id}`),
    metadata: { type: 'anime', animeId: record.id, status: record.status },
    searchText: jsonText({
      title: record.title,
      originalTitle: record.originalTitle,
      summary: record.summary,
      notes: record.notes,
      tags: record.tags,
      cast: record.cast,
      castAliases: record.castAliases,
      status: record.status,
    }),
  };
}

function documentFromManga(record: MangaRecord): SearchDocument {
  const detail = {
    ...exposeManga(record),
    sourceUrl: sourceUrl(`/manga/${record.id}`),
  };
  return {
    id: `manga:${record.id}`,
    title: record.title,
    text: jsonText(detail),
    url: sourceUrl(`/manga/${record.id}`),
    metadata: { type: 'manga', mangaId: record.id, status: record.status },
    searchText: jsonText({
      title: record.title,
      originalTitle: record.originalTitle,
      aliases: record.aliases,
      summary: record.summary,
      notes: record.notes,
      tags: record.tags,
      authors: record.authors,
      illustrators: record.illustrators,
      publishers: record.publishers,
      status: record.status,
    }),
  };
}

function documentFromNote(note: AnimeNoteEntry, anime?: AnimeRecord): SearchDocument {
  const title = anime
    ? `${anime.title}${note.episode ? ` 第${note.episode}集` : ''}笔记`
    : `动漫笔记 ${note.id}`;
  const detail = {
    ...exposeNote(note),
    anime: anime ? exposeAnime(anime) : undefined,
    sourceUrl: sourceUrl(`/anime/${note.animeId}`),
  };
  return {
    id: `note:${note.id}`,
    title,
    text: jsonText(detail),
    url: sourceUrl(`/anime/${note.animeId}`),
    metadata: { type: 'anime_note', noteId: note.id, animeId: note.animeId },
    searchText: jsonText(detail),
  };
}

function documentFromHistory(record: WatchHistoryRecord, anime?: AnimeRecord): SearchDocument {
  const title = `${record.animeTitle} 第${record.episode}集观看记录`;
  const detail = {
    ...exposeHistory(record),
    anime: anime ? exposeAnime(anime) : undefined,
    sourceUrl: sourceUrl(`/anime/${record.animeId}`),
  };
  return {
    id: `history:${record.id}`,
    title,
    text: jsonText(detail),
    url: sourceUrl(`/anime/${record.animeId}`),
    metadata: { type: 'watch_history', historyId: record.id, animeId: record.animeId },
    searchText: jsonText(detail),
  };
}

async function loadSearchDocuments(): Promise<SearchDocument[]> {
  const [animeResult, mangaRecords, notes, history] = await Promise.all([
    listAllAnimeRecords(),
    listMangaRecords(),
    Promise.resolve(listAllAnimeNotes()),
    getAllWatchHistory(),
  ]);
  const animeRecords = animeResult;
  const animeById = new Map(animeRecords.map((record) => [record.id, record]));

  return [
    ...animeRecords.map(documentFromAnime),
    ...mangaRecords.map(documentFromManga),
    ...notes.map((note) => documentFromNote(note, animeById.get(note.animeId))),
    ...history.map((record) => documentFromHistory(record, animeById.get(record.animeId))),
  ];
}

function scoreDocument(document: SearchDocument, query: string): number {
  const normalizedQuery = query.toLocaleLowerCase();
  const title = document.title.toLocaleLowerCase();
  const text = document.searchText.toLocaleLowerCase();
  const terms = normalizedQuery.split(/[\s,，。！？、；;:：]+/).filter(Boolean);
  if (terms.length > 0 && terms.some((term) => !text.includes(term) && !title.includes(term))) return 0;

  let score = 1;
  if (title.includes(normalizedQuery)) score += 1000;
  if (text.includes(normalizedQuery)) score += 100;
  for (const term of terms) {
    if (title.includes(term)) score += 50;
    if (text.includes(term)) score += 10;
  }
  return score;
}

export async function searchMcpDocuments(query: string): Promise<McpSearchResult[]> {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return [];

  const documents = await loadSearchDocuments();
  return documents
    .map((document) => ({ document, score: scoreDocument(document, normalizedQuery) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))
    .slice(0, MCP_MAX_SEARCH_RESULTS)
    .map(({ document }) => ({
      id: document.id,
      title: document.title,
      url: document.url,
    }));
}

export async function fetchMcpDocument(id: string): Promise<McpFetchResult | null> {
  const match = /^(anime|manga|note|history):(\d+)$/.exec(id.trim());
  if (!match) return null;
  const numericId = Number(match[2]);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null;

  if (match[1] === 'anime') {
    const detail = await getAnimeDetailData(numericId);
    return detail ? {
      id,
      title: detail.title,
      text: jsonText(detail),
      url: sourceUrl(`/anime/${numericId}`),
      metadata: { type: 'anime', animeId: numericId },
    } : null;
  }

  if (match[1] === 'manga') {
    const detail = await getMangaDetailData(numericId);
    return detail ? {
      id,
      title: detail.title,
      text: jsonText(detail),
      url: sourceUrl(`/manga/${numericId}`),
      metadata: { type: 'manga', mangaId: numericId },
    } : null;
  }

  const [notes, history, animeResult] = await Promise.all([
    Promise.resolve(listAllAnimeNotes()),
    getAllWatchHistory(),
    listAllAnimeRecords(),
  ]);
  const animeById = new Map(animeResult.map((record) => [record.id, record]));

  if (match[1] === 'note') {
    const note = notes.find((item) => item.id === numericId);
    if (!note) return null;
    const document = documentFromNote(note, animeById.get(note.animeId));
    return {
      id: document.id,
      title: document.title,
      text: document.text,
      url: document.url,
      metadata: document.metadata,
    };
  }

  const record = history.find((item) => item.id === numericId);
  if (!record) return null;
  const document = documentFromHistory(record, animeById.get(record.animeId));
  return {
    id: document.id,
    title: document.title,
    text: document.text,
    url: document.url,
    metadata: document.metadata,
  };
}
