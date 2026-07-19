import { extractSeasonNumber } from './chinese-parser';

export interface AnimeMetadata {
    coverUrl?: string;
    totalEpisodes?: number;
    title?: string;
    originalTitle?: string;
    score?: number;
    durationMinutes?: number;
    description?: string;
    premiereDate?: string;
    cast?: string[];
    castAliases?: string[];
    isFinished?: boolean;
    tags?: string[];
}

export interface AnimeMetadataCandidate {
    id: number;
    title: string;
    originalTitle?: string;
    season?: number;
    premiereDate?: string;
    totalEpisodes?: number;
}

export interface AnimeMetadataQueryTrace {
    query: string;
    candidateCount: number;
    candidates: AnimeMetadataCandidate[];
    selected?: AnimeMetadataCandidate;
}

export interface AnimeMetadataLookupResult {
    metadata: AnimeMetadata | null;
    trace: AnimeMetadataQueryTrace[];
    selected?: AnimeMetadataCandidate;
}

function normalizeDateString(value: Date | string | number | null | undefined) {
    if (!value) {
        return undefined;
    }

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            return undefined;
        }

        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
        return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ── Bangumi v0 API ────────────────────────────────────────────────────────────

const USER_AGENT = 'AnimeTrack/1.0 (personal tracker)';
const MAX_CAST_MEMBERS = 10;
const FETCH_TIMEOUT_MS = 8000;

interface BangumiV0Subject {
    id: number;
    name: string;
    name_cn?: string;
    date?: string;
    eps?: number;
    images?: { large?: string; common?: string; medium?: string };
    rating?: { score?: number };
    summary?: string;
    tags?: Array<{ name: string; count?: number }>;
    infobox?: Array<{ key: string; value: unknown }>;
}

interface BangumiV0Character {
    actors?: Array<{ name?: string; name_cn?: string }>;
}

function stringifyInfoboxValue(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.map(stringifyInfoboxValue).filter(Boolean).join(' ');
    }

    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).map(stringifyInfoboxValue).filter(Boolean).join(' ');
    }

    return '';
}

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function extractSubjectTags(detail: BangumiV0Subject) {
    return Array.isArray(detail.tags)
        ? detail.tags.sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 12).map((tag) => tag.name).filter(Boolean)
        : undefined;
}

function extractSubjectTotalEpisodes(detail: BangumiV0Subject) {
    if (detail.eps && detail.eps > 0) {
        return detail.eps;
    }

    const entry = detail.infobox?.find((item) => item.key === '话数' || item.key === '集数');
    const parsed = parseInt(String(entry?.value ?? ''), 10);
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * 搜索 Bangumi v0，返回所有 name 精确匹配的候选，再返回 partial 候选。
 * 第一个 query 通常是日文原名（由 AI 提供），命中率极高。
 */
async function searchBangumiV0(keyword: string): Promise<BangumiV0Subject[]> {
    try {
        const res = await fetchWithTimeout('https://api.bgm.tv/v0/search/subjects?limit=10', {
            method: 'POST',
            headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword, filter: { type: [2] }, sort: 'match' }),
        });
        if (!res.ok) {
            console.warn(`[anime-provider] Bangumi search failed HTTP ${res.status}`, { keyword });
            return [];
        }
        const data = await res.json() as { data?: BangumiV0Subject[] };
        return data?.data ?? [];
    } catch (error) {
        console.warn('[anime-provider] Bangumi search failed', {
            keyword,
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}

async function fetchSubjectDetail(subjectId: number): Promise<BangumiV0Subject | null> {
    try {
        const res = await fetchWithTimeout(`https://api.bgm.tv/v0/subjects/${subjectId}`, {
            headers: { 'User-Agent': USER_AGENT },
        });
        if (!res.ok) return null;
        return res.json() as Promise<BangumiV0Subject>;
    } catch {
        return null;
    }
}

async function fetchSubjectCharacters(subjectId: number): Promise<BangumiV0Character[]> {
    try {
        const res = await fetchWithTimeout(`https://api.bgm.tv/v0/subjects/${subjectId}/characters`, {
            headers: { 'User-Agent': USER_AGENT },
        });
        if (!res.ok) return [];
        return res.json() as Promise<BangumiV0Character[]>;
    } catch {
        return [];
    }
}

function toAnimeMetadataCandidate(subject: BangumiV0Subject): AnimeMetadataCandidate {
    return {
        id: subject.id,
        title: subject.name_cn || subject.name,
        originalTitle: subject.name,
        season: extractSeasonNumber(subject.name_cn) ?? extractSeasonNumber(subject.name),
        premiereDate: normalizeDate(subject.date),
        totalEpisodes: subject.eps && subject.eps > 0 ? subject.eps : undefined,
    };
}

export const normalizeDate = normalizeDateString;

function extractIsFinished(detail: BangumiV0Subject): boolean | undefined {
    const endEntry = detail.infobox?.find(i => i.key === '播放结束' || i.key === '放送结束');
    if (!endEntry?.value) return undefined;
    const dateStr = String(endEntry.value).replace(/(\d{4})年(\d{1,2})月(\d{1,2})日/, '$1-$2-$3');
    const endDate = new Date(dateStr);
    if (isNaN(endDate.getTime())) return undefined;
    return endDate < new Date();
}

function extractCast(characters: BangumiV0Character[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const ch of characters) {
        const name = ch.actors?.[0]?.name;
        if (name && !seen.has(name)) { seen.add(name); result.push(name); }
        if (result.length >= MAX_CAST_MEMBERS) break;
    }
    return result;
}

function extractDurationMinutes(detail: BangumiV0Subject): number | undefined {
    const entry = detail.infobox?.find((item) => /时长|片长|单集片长|播放时长|放送时长|每话长|每集长/i.test(String(item.key ?? '')));
    if (!entry) {
        return undefined;
    }

    const text = stringifyInfoboxValue(entry.value).replace(/\s+/g, ' ').trim();
    if (!text) {
        return undefined;
    }

    const minuteMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:分钟|分|min|mins|minute|minutes)\b/i)
        || text.match(/(?:约|每集|每话)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:m)\b/i)
        || text.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!minuteMatch) {
        return undefined;
    }

    const parsed = Number(minuteMatch[1]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

/**
 * 尝试多个查询词依次搜索 Bangumi，返回第一个成功匹配的元数据。
 * 调用方通常按「日文原名 → 标准中文名 → 用户输入」顺序传入。
 */
export async function fetchAnimeMetadata(title: string): Promise<AnimeMetadata | null> {
    return fetchAnimeMetadataByQueries(title);
}

/** 仅查询 Bangumi 封面地址，供批量封面恢复使用，避免额外请求详情和角色数据。 */
export async function fetchAnimeCoverByQueries(
    ...queries: Array<string | undefined | null>
): Promise<string | undefined> {
    const validQueries = Array.from(new Set(
        queries.map(query => (query ?? '').trim()).filter(Boolean),
    )).slice(0, 2);
    if (validQueries.length === 0) return undefined;

    for (const keyword of validQueries) {
        const selected = (await searchBangumiV0(keyword))[0];
        const coverUrl = selected?.images?.large ?? selected?.images?.common ?? selected?.images?.medium;
        if (coverUrl) return coverUrl;
    }
    return undefined;
}

/**
 * 返回 Bangumi 自己按 match 排序后的候选列表，不进行本地字符串评分。
 * 多个查询词只做去重和数量限制，最终语义选择由 AI 完成。
 */
export async function searchAnimeMetadataCandidatesByQueries(
    queries: Array<string | undefined | null>,
    limit = 15,
): Promise<AnimeMetadataCandidate[]> {
    const validQueries = Array.from(new Set(
        queries.map(query => (query ?? '').trim()).filter(Boolean),
    ));
    const byId = new Map<number, AnimeMetadataCandidate>();

    for (const keyword of validQueries) {
        const subjects = await searchBangumiV0(keyword);
        for (const subject of subjects) {
            if (!byId.has(subject.id)) byId.set(subject.id, toAnimeMetadataCandidate(subject));
            if (byId.size >= limit) return Array.from(byId.values());
        }
    }

    return Array.from(byId.values());
}

/** 根据 AI 选中的 Bangumi subject ID 获取权威详情。 */
export async function fetchAnimeMetadataBySubjectId(subjectId: number): Promise<AnimeMetadata | null> {
    if (!Number.isInteger(subjectId) || subjectId <= 0) return null;
    const [detail, characters] = await Promise.all([
        fetchSubjectDetail(subjectId),
        fetchSubjectCharacters(subjectId),
    ]);
    if (!detail) return null;

    return {
        title: detail.name_cn || detail.name,
        originalTitle: detail.name,
        coverUrl: detail.images?.large ?? detail.images?.common ?? detail.images?.medium,
        score: detail.rating?.score && detail.rating.score > 0
            ? Math.round(detail.rating.score * 10) / 10
            : undefined,
        durationMinutes: extractDurationMinutes(detail),
        totalEpisodes: extractSubjectTotalEpisodes(detail),
        description: detail.summary?.trim() || undefined,
        premiereDate: normalizeDate(detail.date),
        tags: extractSubjectTags(detail),
        isFinished: extractIsFinished(detail),
        cast: extractCast(characters),
    };
}

export async function fetchAnimeMetadataByQueriesWithTrace(
    ...queries: Array<string | undefined | null>
): Promise<AnimeMetadataLookupResult> {
    const validQueries = queries.map(q => (q ?? '').trim()).filter(Boolean);
    if (validQueries.length === 0) {
        return { metadata: null, trace: [], selected: undefined };
    }

    const trace: AnimeMetadataQueryTrace[] = [];

    const mergedCandidates: AnimeMetadataCandidate[] = [];
    const seenIds = new Set<number>();
    for (const keyword of validQueries) {
        const candidates = await searchBangumiV0(keyword);
        const mappedCandidates = candidates.slice(0, 4).map(toAnimeMetadataCandidate);
        for (const candidate of mappedCandidates) {
            if (!seenIds.has(candidate.id)) {
                seenIds.add(candidate.id);
                mergedCandidates.push(candidate);
            }
        }

        trace.push({
            query: keyword,
            candidateCount: candidates.length,
            candidates: mappedCandidates,
            selected: mappedCandidates[0],
        });
    }

    const selectedCandidate = mergedCandidates[0];
    if (!selectedCandidate) {
        return { metadata: null, trace, selected: undefined };
    }
    const metadata = await fetchAnimeMetadataBySubjectId(selectedCandidate.id);
    return {
        metadata,
        trace,
        selected: selectedCandidate,
    };
}

export async function fetchAnimeMetadataByQueries(
    ...queries: Array<string | undefined | null>
): Promise<AnimeMetadata | null> {
    const result = await fetchAnimeMetadataByQueriesWithTrace(...queries);
    return result.metadata;
}
