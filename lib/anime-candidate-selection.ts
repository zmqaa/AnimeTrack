import {
  extractSeasonNumber,
  normalizeTitleToken,
  stripSeasonToken,
} from './chinese-parser';

export interface AnimeCandidateLike {
  id: number;
  title: string;
  originalTitle?: string;
  season?: number;
}

export interface AnimeCandidateSelectionIntent {
  userTitle: string;
  recognizedTitle?: string;
  recognizedOriginalTitle?: string;
  expectedSeason?: number;
}

export type AnimeCandidateSelectionEvent<T extends AnimeCandidateLike> =
  | { type: 'attempt'; attempt: number }
  | { type: 'invalid-ai-selection'; attempt: number; selectedId?: number }
  | { type: 'selected'; method: 'ai'; attempt: number; candidate: T }
  | { type: 'selected'; method: 'local-fallback'; candidate: T }
  | { type: 'no-selection' };

type RankedCandidate<T> = {
  candidate: T;
  score: number;
};

function uniqueNormalizedTitles(
  values: Array<{ value?: string; weight: number }>,
): Array<{ token: string; baseToken: string; weight: number }> {
  const byToken = new Map<string, { token: string; baseToken: string; weight: number }>();

  for (const { value, weight } of values) {
    const token = normalizeTitleToken(value);
    if (!token) continue;

    const current = byToken.get(token);
    if (!current || current.weight < weight) {
      byToken.set(token, {
        token,
        baseToken: normalizeTitleToken(stripSeasonToken(value)),
        weight,
      });
    }
  }

  return Array.from(byToken.values());
}

function getCandidateSeason(candidate: AnimeCandidateLike): number | undefined {
  return candidate.season
    ?? extractSeasonNumber(candidate.title)
    ?? extractSeasonNumber(candidate.originalTitle);
}

/**
 * 仅在标题/原名精确一致，或明确季度下基础标题一致时选择唯一候选。
 * 这是 AI 无法选择时的保守兜底，不进行包含词、编辑距离等宽松猜测。
 */
export function pickHighConfidenceAnimeCandidate<T extends AnimeCandidateLike>(
  candidates: T[],
  intent: AnimeCandidateSelectionIntent,
): T | null {
  if (candidates.length === 0) return null;

  const expectedSeason = intent.expectedSeason
    ?? extractSeasonNumber(intent.userTitle)
    ?? extractSeasonNumber(intent.recognizedTitle)
    ?? extractSeasonNumber(intent.recognizedOriginalTitle);
  const intentTitles = uniqueNormalizedTitles([
    { value: intent.userTitle, weight: 300 },
    { value: intent.recognizedTitle, weight: 220 },
    { value: intent.recognizedOriginalTitle, weight: 200 },
  ]);
  if (intentTitles.length === 0) return null;

  const ranked = candidates.flatMap((candidate): RankedCandidate<T>[] => {
    const candidateSeason = getCandidateSeason(candidate);
    if (expectedSeason && candidateSeason && candidateSeason !== expectedSeason) {
      return [];
    }

    const candidateTitles = uniqueNormalizedTitles([
      { value: candidate.title, weight: 20 },
      { value: candidate.originalTitle, weight: 10 },
    ]);
    let score = 0;

    for (const intentTitle of intentTitles) {
      for (const candidateTitle of candidateTitles) {
        if (intentTitle.token === candidateTitle.token) {
          score = Math.max(score, 1_000 + intentTitle.weight + candidateTitle.weight);
          continue;
        }

        if (
          expectedSeason
          && candidateSeason === expectedSeason
          && intentTitle.baseToken
          && intentTitle.baseToken === candidateTitle.baseToken
        ) {
          score = Math.max(score, 700 + intentTitle.weight + candidateTitle.weight);
        }
      }
    }

    return score > 0 ? [{ candidate, score }] : [];
  }).sort((left, right) => right.score - left.score);

  if (ranked.length === 0) return null;
  if (ranked[1]?.score === ranked[0].score) return null;
  return ranked[0].candidate;
}

/**
 * AI 首次未返回有效候选时重试一次，之后才启用严格本地兜底。
 */
export async function selectAnimeCandidateWithRetry<T extends AnimeCandidateLike>(
  candidates: T[],
  intent: AnimeCandidateSelectionIntent,
  requestSelectedId: (attempt: number) => Promise<number | null | undefined>,
  report?: (event: AnimeCandidateSelectionEvent<T>) => void,
): Promise<T | null> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    report?.({ type: 'attempt', attempt });
    try {
      const selectedId = await requestSelectedId(attempt);
      const selected = selectedId
        ? candidates.find((candidate) => candidate.id === selectedId)
        : undefined;
      if (selected) {
        report?.({ type: 'selected', method: 'ai', attempt, candidate: selected });
        return selected;
      }
      report?.({
        type: 'invalid-ai-selection',
        attempt,
        ...(selectedId ? { selectedId } : {}),
      });
    } catch {
      // 单次上游错误也按未选择处理，最多再尝试一次后使用本地兜底。
      report?.({ type: 'invalid-ai-selection', attempt });
    }
  }

  const fallback = pickHighConfidenceAnimeCandidate(candidates, intent);
  if (fallback) {
    report?.({ type: 'selected', method: 'local-fallback', candidate: fallback });
    return fallback;
  }

  report?.({ type: 'no-selection' });
  return null;
}
