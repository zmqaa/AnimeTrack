import {
  extractSeasonNumber,
  hasSeasonMarker,
  normalizeTitleToken,
} from './chinese-parser';

export interface AnimeTitleCandidate {
  title: string;
  original_title?: string | null;
  premiere_date?: string | null;
  createdAt: string;
  updatedAt: string;
}

function normalizeComparableText(value: string | undefined): string {
  return normalizeTitleToken(value)
    .replace(/第[一二三四五六七八九十百零两〇0-9]+[季期]/gi, '')
    .trim();
}

function getCandidateSeason(candidate: AnimeTitleCandidate): number | undefined {
  return extractSeasonNumber(candidate.title)
    || extractSeasonNumber(candidate.original_title || undefined);
}

function classifyPrefixSuffix(
  queryTitle: string,
  candidateTitle: string,
): 'none' | 'exact' | 'first-season' | 'later-season' | 'subtitle' {
  const trimmedQuery = queryTitle.trim();
  const trimmedCandidate = candidateTitle.trim();
  if (!trimmedQuery || !trimmedCandidate.startsWith(trimmedQuery)) return 'none';

  const suffix = trimmedCandidate.slice(trimmedQuery.length).trim();
  if (!suffix) return 'exact';
  if (/^第\s*[一1]\s*[季期]$/i.test(suffix) || /^season\s*1$/i.test(suffix) || /^s\s*1$/i.test(suffix)) {
    return 'first-season';
  }
  if (
    /^第\s*[0-9一二三四五六七八九十百零两〇]+\s*[季期]$/i.test(suffix)
    || /^season\s*[0-9]{1,3}$/i.test(suffix)
    || /^s\s*[0-9]{1,3}$/i.test(suffix)
  ) {
    return 'later-season';
  }
  return 'subtitle';
}

function toSortableTime(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function scoreAnimeTitleCandidate<T extends AnimeTitleCandidate>(
  candidate: T,
  queryTitle: string,
) {
  const trimmedQuery = queryTitle.trim();
  const queryToken = normalizeTitleToken(trimmedQuery);
  const queryComparable = normalizeComparableText(trimmedQuery);
  const queryHasSeason = hasSeasonMarker(trimmedQuery);
  const requestedSeason = extractSeasonNumber(trimmedQuery);

  const title = candidate.title.trim();
  const originalTitle = (candidate.original_title || '').trim();
  const titleToken = normalizeTitleToken(title);
  const originalTitleToken = normalizeTitleToken(originalTitle);
  const titleComparable = normalizeComparableText(title);
  const originalComparable = normalizeComparableText(originalTitle);
  const candidateSeason = getCandidateSeason(candidate);
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
    else if (candidateSeason !== undefined) {
      score -= Math.abs(candidateSeason - requestedSeason) * 700;
    }
  } else {
    if (candidateSeason === 1) score += 450;
    else if (candidateSeason && candidateSeason > 1) score -= candidateSeason * 180;
    if (prefixKind === 'later-season') score -= 300;
    if (prefixKind === 'subtitle') score -= 120;
  }

  return {
    candidate,
    score,
    premiereTime: toSortableTime(candidate.premiere_date, Number.MAX_SAFE_INTEGER),
    createdTime: toSortableTime(candidate.createdAt, Number.MAX_SAFE_INTEGER),
    updatedTime: toSortableTime(candidate.updatedAt, 0),
  };
}

/**
 * 从数据库的模糊查询结果中选择最符合用户标题和季数意图的记录。
 */
export function pickBestAnimeTitleCandidate<T extends AnimeTitleCandidate>(
  candidates: T[],
  queryTitle: string,
): T | null {
  if (candidates.length === 0) return null;

  const queryHasSeason = hasSeasonMarker(queryTitle);
  const ranked = candidates
    .map((candidate) => scoreAnimeTitleCandidate(candidate, queryTitle))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (!queryHasSeason && left.premiereTime !== right.premiereTime) {
        return left.premiereTime - right.premiereTime;
      }
      if (right.updatedTime !== left.updatedTime) return right.updatedTime - left.updatedTime;
      return left.createdTime - right.createdTime;
    });

  return ranked[0]?.candidate || null;
}
