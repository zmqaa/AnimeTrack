/**
 * Quick record 辅助逻辑：重刷检测、日期/进度推导、patch 构建
 * 从 quick-record/route.ts 拆出的纯函数层
 */

import { extractSeasonNumber, hasSeasonMarker, parseChineseNumberToken } from '@/lib/chinese-parser';
import { uniqueStrings } from '@/lib/anime-cast';
import type { AnimeRecord } from '@/lib/anime';
import type { ParsedQuickRecordIntent } from '@/lib/ai';

// ── 重刷 (rewatch) 工具 ──

export function parseRewatchCountToken(token: string): number | undefined {
  const normalized = token.trim();
  if (!normalized) return undefined;

  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 2 ? parsed : undefined;
  }

  const result = parseChineseNumberToken(normalized);
  return result !== undefined && result >= 2 ? result : undefined;
}

export function detectRewatchTag(text: string): string | undefined {
  const compact = text.replace(/\s+/g, '');
  if (!compact) return undefined;

  const countToken = compact.match(/([0-9]{1,3}|[一二两三四五六七八九十]+)\s*刷/i)?.[1];
  if (countToken) {
    const count = parseRewatchCountToken(countToken);
    if (count && count >= 2) return `${count}刷`;
  }

  if (/二周目|重刷|重温|再刷/i.test(compact)) return '二刷';
  return undefined;
}

function parseRewatchTagCount(tag: string): number | undefined {
  const match = tag.trim().match(/^([0-9]{1,3}|[一二两三四五六七八九十]+)刷$/i);
  if (!match) return undefined;
  return parseRewatchCountToken(match[1]);
}

function formatRewatchTag(count: number): string {
  const cjkMap: Record<number, string> = { 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十' };
  return cjkMap[count] ? `${cjkMap[count]}刷` : `${count}刷`;
}

export function resolveNextRewatchTag(records: Pick<AnimeRecord, 'tags'>[]): string {
  let highestCount = 1;
  for (const record of records) {
    for (const tag of record.tags ?? []) {
      const parsed = parseRewatchTagCount(tag);
      if (parsed && parsed > highestCount) highestCount = parsed;
    }
  }
  const baselineCount = Math.max(records.length, 1);
  return formatRewatchTag(Math.max(2, highestCount + 1, baselineCount + 1));
}

export function validateSeasonSelection(rawText: string, parsed: Pick<ParsedQuickRecordIntent, 'animeTitle' | 'originalTitle' | 'season'>): void {
  const parsedSeason = parsed.season
    || extractSeasonNumber(parsed.animeTitle)
    || extractSeasonNumber(parsed.originalTitle);
  if (!parsedSeason || parsedSeason <= 1 || hasSeasonMarker(rawText)) return;

  // Keep punctuation because symbols such as NEW GAME! / NEW GAME!! distinguish seasons.
  const compact = (value: string | undefined) => (value || '').toLowerCase().replace(/\s+/g, '');
  const rawToken = compact(rawText);
  const parsedTitleToken = compact(parsed.animeTitle);
  const parsedOriginalToken = compact(parsed.originalTitle);
  const userNamedOfficialEntry = Boolean(
    (parsedTitleToken && rawToken.includes(parsedTitleToken))
    || (parsedOriginalToken && rawToken.includes(parsedOriginalToken))
  );

  if (!userNamedOfficialEntry) {
    throw new Error('没有明确指定季度，已停止录入，避免误识别为续作');
  }
}

// ── 数组合并 ──

export function mergeStringArrays(...arrays: Array<string[] | undefined>): string[] | undefined {
  const merged = uniqueStrings(arrays.flatMap((items) => items || []));
  return merged.length > 0 ? merged : undefined;
}

// ── Recognition 结构 ──

export function buildRecognition(
  parsed: ParsedQuickRecordIntent,
  entry: Pick<AnimeRecord, 'title' | 'originalTitle'> | undefined,
  progress: number,
  enriched: boolean,
  historyWritten: boolean,
  watchedAt: string | undefined,
  status: string,
) {
  return {
    standardTitle: parsed.animeTitle,
    originalTitle: parsed.originalTitle || null,
    season: parsed.season || null,
    episode: parsed.episode ?? null,
    progress,
    status,
    watchedAt: watchedAt || null,
    matchedTitle: entry?.title || null,
    matchedOriginalTitle: entry?.originalTitle || null,
    isHistorical: Boolean(parsed.isHistorical),
    enriched,
    historyWritten,
  };
}
