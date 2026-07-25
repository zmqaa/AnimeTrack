import { describe, expect, it } from 'vitest';

import {
  buildAnimeListUrlParams,
  parseAnimeListUrlState,
} from '../../app/anime/anime-page-helpers';

describe('anime list URL state', () => {
  it('parses every supported list control from the URL', () => {
    const state = parseAnimeListUrlState(new URLSearchParams(
      'status=completed&search=芙莉莲&cast=种崎敦美&tag=奇幻&sortBy=score&sortOrder=asc&page=3',
    ));

    expect(state).toEqual({
      status: 'completed',
      search: '芙莉莲',
      cast: '种崎敦美',
      tag: '奇幻',
      sortBy: 'score',
      sortOrder: 'asc',
      page: 3,
    });
  });

  it('falls back safely when URL values are invalid', () => {
    const state = parseAnimeListUrlState(new URLSearchParams(
      'status=unknown&sortBy=nope&sortOrder=sideways&page=-2',
    ));

    expect(state).toMatchObject({
      status: 'all',
      sortBy: 'lastWatchedAt',
      sortOrder: 'desc',
      page: 1,
    });
  });

  it('writes non-default controls and removes default values', () => {
    const active = buildAnimeListUrlParams(new URLSearchParams('source=shared'), {
      status: 'watching',
      cast: '早见沙织',
      tag: '治愈',
      sortBy: 'title',
      sortOrder: 'asc',
      page: 4,
    });

    expect(active.toString()).toBe(
      'source=shared&status=watching&cast=%E6%97%A9%E8%A7%81%E6%B2%99%E7%BB%87&tag=%E6%B2%BB%E6%84%88&sortBy=title&sortOrder=asc&page=4',
    );

    const reset = buildAnimeListUrlParams(active, {
      status: 'all',
      cast: '',
      tag: '',
      sortBy: 'lastWatchedAt',
      sortOrder: 'desc',
      page: 1,
    });

    expect(reset.toString()).toBe('source=shared');
  });
});
