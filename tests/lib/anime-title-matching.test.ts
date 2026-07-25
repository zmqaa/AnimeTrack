import { describe, expect, it } from 'vitest';

import {
  type AnimeTitleCandidate,
  pickBestAnimeTitleCandidate,
} from '../../lib/anime-title-matching';

function candidate(
  title: string,
  overrides: Partial<AnimeTitleCandidate> = {},
): AnimeTitleCandidate {
  return {
    title,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

describe('anime title candidate matching', () => {
  it('prefers an exact display title over a longer related title', () => {
    const exact = candidate('葬送的芙莉莲');
    const sequel = candidate('葬送的芙莉莲 第二季');

    expect(pickBestAnimeTitleCandidate([sequel, exact], '葬送的芙莉莲')).toBe(exact);
  });

  it('prefers the first season when the query does not specify a season', () => {
    const firstSeason = candidate('间谍过家家 第一季');
    const secondSeason = candidate('间谍过家家 第二季');

    expect(pickBestAnimeTitleCandidate(
      [secondSeason, firstSeason],
      '间谍过家家',
    )).toBe(firstSeason);
  });

  it('selects the requested season explicitly', () => {
    const firstSeason = candidate('Re:Zero Season 1');
    const thirdSeason = candidate('Re:Zero Season 3');

    expect(pickBestAnimeTitleCandidate(
      [firstSeason, thirdSeason],
      'Re:Zero Season 3',
    )).toBe(thirdSeason);
  });

  it('matches an exact original title', () => {
    const translated = candidate('孤独摇滚！', { original_title: 'ぼっち・ざ・ろっく！' });
    const related = candidate('孤独摇滚！剧场版');

    expect(pickBestAnimeTitleCandidate(
      [related, translated],
      'ぼっち・ざ・ろっく！',
    )).toBe(translated);
  });

  it('uses the earlier premiere as a stable tie-breaker for an unspecified season', () => {
    const earlier = candidate('作品 第一季', { premiere_date: '2023-01-01' });
    const later = candidate('作品 第一期', { premiere_date: '2024-01-01' });

    expect(pickBestAnimeTitleCandidate([later, earlier], '作品')).toBe(earlier);
  });

  it('returns null when there are no candidates', () => {
    expect(pickBestAnimeTitleCandidate([], '任意标题')).toBeNull();
  });
});
