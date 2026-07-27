import { describe, expect, it } from 'vitest';

import {
  buildAnimeViewingStats,
  getContentTags,
  getRewatchTag,
  isRewatchRecord,
  isRewatchTag,
} from '../../lib/anime-viewing-stats';

describe('anime viewing stats', () => {
  it('recognizes rewatch tags without treating content tags as rewatch metadata', () => {
    expect(isRewatchTag('二刷')).toBe(true);
    expect(isRewatchTag(' 12刷 ')).toBe(true);
    expect(isRewatchTag('治愈')).toBe(false);
    expect(getRewatchTag(['日常', '三刷'])).toBe('三刷');
    expect(getContentTags(['日常', '二刷', ' 治愈 '])).toEqual(['日常', '治愈']);
    expect(isRewatchRecord({ tags: ['二刷'] })).toBe(true);
  });

  it('separates unique works and rewatch runs while accumulating all viewing volume', () => {
    const stats = buildAnimeViewingStats([
      { status: 'completed', progress: 12, durationMinutes: 25, tags: ['日常'] },
      { status: 'watching', progress: 3, durationMinutes: 24, tags: ['奇幻'] },
      { status: 'plan_to_watch', progress: 0, tags: [] },
      { status: 'completed', progress: 12, durationMinutes: 25, tags: ['日常', '二刷'] },
      { status: 'watching', progress: 2, durationMinutes: 25, tags: ['日常', '三刷'] },
    ]);

    expect(stats).toEqual({
      libraryWorks: 3,
      watchedWorks: 2,
      completedWorks: 1,
      watchingWorks: 1,
      droppedWorks: 0,
      plannedWorks: 1,
      rewatchRuns: 2,
      completedRewatchRuns: 1,
      watchedEpisodes: 29,
      rewatchEpisodes: 14,
      totalMinutes: 722,
    });
  });
});
