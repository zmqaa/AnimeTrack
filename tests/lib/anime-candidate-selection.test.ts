import { describe, expect, it, vi } from 'vitest';

import {
  pickHighConfidenceAnimeCandidate,
  selectAnimeCandidateWithRetry,
  type AnimeCandidateLike,
} from '../../lib/anime-candidate-selection';

function candidate(
  id: number,
  title: string,
  overrides: Partial<AnimeCandidateLike> = {},
): AnimeCandidateLike {
  return { id, title, ...overrides };
}

describe('Bangumi candidate selection fallback', () => {
  it('selects an exact title', () => {
    const exact = candidate(1, '葬送的芙莉莲');
    const sequel = candidate(2, '葬送的芙莉莲 第二季', { season: 2 });

    expect(pickHighConfidenceAnimeCandidate(
      [sequel, exact],
      { userTitle: '葬送的芙莉莲' },
    )).toBe(exact);
  });

  it('matches a recognized original-title alias', () => {
    const match = candidate(1, '孤独摇滚！', { originalTitle: 'ぼっち・ざ・ろっく！' });
    const movie = candidate(2, '孤独摇滚！剧场版');

    expect(pickHighConfidenceAnimeCandidate(
      [movie, match],
      {
        userTitle: 'Bocchi the Rock',
        recognizedOriginalTitle: 'ぼっち・ざ・ろっく！',
      },
    )).toBe(match);
  });

  it('uses an explicit season to select the matching entry', () => {
    const first = candidate(1, '间谍过家家', { season: 1 });
    const second = candidate(2, '间谍过家家', { season: 2 });

    expect(pickHighConfidenceAnimeCandidate(
      [first, second],
      { userTitle: '间谍过家家 第二季', expectedSeason: 2 },
    )).toBe(second);
  });

  it('returns null for equally strong ambiguous candidates', () => {
    const firstRelease = candidate(1, '作品', { originalTitle: 'WORK' });
    const remake = candidate(2, '作品', { originalTitle: 'WORK' });

    expect(pickHighConfidenceAnimeCandidate(
      [firstRelease, remake],
      { userTitle: '作品' },
    )).toBeNull();
  });

  it('returns null when only a loosely related title exists', () => {
    expect(pickHighConfidenceAnimeCandidate(
      [candidate(1, '转生成为反派大小姐')],
      { userTitle: '我推的反派大小姐' },
    )).toBeNull();
  });

  it('retries once and accepts the second valid AI selection', async () => {
    const selected = candidate(2, '第二候选');
    const progress: string[] = [];
    const requestSelectedId = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(2);

    await expect(selectAnimeCandidateWithRetry(
      [candidate(1, '第一候选'), selected],
      { userTitle: '不触发本地匹配' },
      requestSelectedId,
      (event) => progress.push(
        event.type === 'selected' ? `${event.type}:${event.method}` : event.type,
      ),
    )).resolves.toBe(selected);
    expect(requestSelectedId).toHaveBeenCalledTimes(2);
    expect(progress).toEqual([
      'attempt',
      'invalid-ai-selection',
      'attempt',
      'selected:ai',
    ]);
  });

  it('uses the strict fallback after two invalid AI responses', async () => {
    const exact = candidate(1, '药屋少女的呢喃');
    const progress: string[] = [];
    const requestSelectedId = vi.fn()
      .mockResolvedValueOnce(999)
      .mockResolvedValueOnce(null);

    await expect(selectAnimeCandidateWithRetry(
      [exact],
      { userTitle: '药屋少女的呢喃' },
      requestSelectedId,
      (event) => progress.push(
        event.type === 'selected' ? `${event.type}:${event.method}` : event.type,
      ),
    )).resolves.toBe(exact);
    expect(requestSelectedId).toHaveBeenCalledTimes(2);
    expect(progress.at(-1)).toBe('selected:local-fallback');
  });
});
