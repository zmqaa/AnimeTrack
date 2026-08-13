import 'server-only';
import { isValidCalendarDate } from './date-utils';

const BANGUMI_SEARCH_URL = 'https://api.bgm.tv/v0/search/subjects?limit=10';
const BANGUMI_SUBJECT_URL = 'https://api.bgm.tv/v0/subjects';
const USER_AGENT = 'AnimeTrack/1.0 (personal tracker)';
const FETCH_TIMEOUT_MS = 8_000;
const HYDRATED_CANDIDATE_LIMIT = 5;

type BangumiInfoboxItem = {
  key?: string;
  value?: unknown;
};

type BangumiBookSubject = {
  id: number;
  name: string;
  name_cn?: string;
  date?: string;
  volumes?: number;
  eps?: number;
  summary?: string;
  images?: { large?: string; common?: string; medium?: string };
  tags?: Array<{ name?: string; count?: number }>;
  infobox?: BangumiInfoboxItem[];
};

export type MangaMetadataCandidate = {
  id: number;
  title: string;
  originalTitle?: string;
  aliases: string[];
  authors: string[];
  illustrators: string[];
  publishers: string[];
  serializations: string[];
  releaseDate?: string;
  startDate?: string;
  endDate?: string;
  volumeCount?: number;
  chapterCount?: number;
  isFinished?: boolean;
  coverUrl?: string;
  summary?: string;
  tags: string[];
  detailLoaded: boolean;
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function flattenInfoboxValue(value: unknown): string[] {
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenInfoboxValue);
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  if (typeof record.v === 'string' || typeof record.v === 'number') return [String(record.v)];
  return Object.values(record).flatMap(flattenInfoboxValue);
}

function findInfoboxValues(subject: BangumiBookSubject, keys: RegExp) {
  return uniqueStrings((subject.infobox || [])
    .filter((item) => keys.test(String(item.key || '')))
    .flatMap((item) => flattenInfoboxValue(item.value)));
}

function parsePositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  const match = String(value || '').match(/\d+/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseDate(value: unknown): string | undefined {
  const match = String(value || '').match(/(\d{4})[-年/.](\d{1,2})[-月/.](\d{1,2})/);
  if (!match) return undefined;
  const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return isValidCalendarDate(date) ? date : undefined;
}

function firstInfoboxValue(subject: BangumiBookSubject, keys: RegExp) {
  return findInfoboxValues(subject, keys)[0];
}

function toCandidate(subject: BangumiBookSubject, detailLoaded: boolean): MangaMetadataCandidate {
  const volumeValue = firstInfoboxValue(subject, /^(?:册数|卷数)$/);
  const chapterValue = firstInfoboxValue(subject, /^(?:话数|章节数)$/);
  const startValue = firstInfoboxValue(subject, /^(?:开始|连载开始)$/);
  const endValue = firstInfoboxValue(subject, /^(?:结束|连载结束)$/);

  return {
    id: subject.id,
    title: subject.name_cn?.trim() || subject.name,
    originalTitle: subject.name?.trim() || undefined,
    aliases: findInfoboxValues(subject, /^(?:别名|又名)$/),
    authors: findInfoboxValues(subject, /^(?:作者|原作)$/),
    illustrators: findInfoboxValues(subject, /^(?:作画|插画)$/),
    publishers: findInfoboxValues(subject, /^(?:出版社)$/),
    serializations: findInfoboxValues(subject, /^(?:连载杂志|连载平台)$/),
    releaseDate: parseDate(subject.date),
    startDate: parseDate(startValue),
    endDate: parseDate(endValue),
    volumeCount: parsePositiveInteger(subject.volumes) || parsePositiveInteger(volumeValue),
    chapterCount: parsePositiveInteger(subject.eps) || parsePositiveInteger(chapterValue),
    isFinished: endValue ? true : undefined,
    coverUrl: subject.images?.large || subject.images?.common || subject.images?.medium,
    summary: subject.summary?.trim() || undefined,
    tags: Array.isArray(subject.tags)
      ? subject.tags
        .slice()
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .map((tag) => tag.name || '')
        .filter(Boolean)
        .slice(0, 12)
      : [],
    detailLoaded,
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Bangumi 请求失败（HTTP ${response.status}）`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSubjectDetail(id: number): Promise<BangumiBookSubject | null> {
  try {
    return await fetchJson(`${BANGUMI_SUBJECT_URL}/${id}`, {
      headers: { 'User-Agent': USER_AGENT },
    }) as BangumiBookSubject;
  } catch (error) {
    console.warn('[manga-provider] Bangumi detail failed', {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function getMangaMetadataCandidate(
  id: number,
): Promise<MangaMetadataCandidate | null> {
  const detail = await fetchSubjectDetail(id);
  return detail ? toCandidate(detail, true) : null;
}

export async function searchMangaMetadataCandidates(
  title: string,
): Promise<MangaMetadataCandidate[]> {
  const payload = await fetchJson(BANGUMI_SEARCH_URL, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: title, filter: { type: [1] }, sort: 'match' }),
  }) as { data?: BangumiBookSubject[] };

  const subjects = Array.isArray(payload.data) ? payload.data : [];
  const details = await Promise.all(
    subjects.slice(0, HYDRATED_CANDIDATE_LIMIT).map((subject) => fetchSubjectDetail(subject.id)),
  );

  return subjects.map((subject, index) => {
    const detail = details[index];
    return detail ? toCandidate(detail, true) : toCandidate(subject, false);
  });
}
