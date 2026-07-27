import { describe, expect, it } from 'vitest';

import { buildDashboardOverview } from '../../lib/dashboard-overview-helpers';
import type { AnimeRecord, WatchHistoryRecord } from '../../lib/dashboard-types';

function anime(overrides: Partial<AnimeRecord> & Pick<AnimeRecord, 'id' | 'title' | 'status'>): AnimeRecord {
  return {
    progress: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('dashboard overview aggregation', () => {
  it('builds the dashboard cards, facets and activity scales on the server', () => {
    const animeList: AnimeRecord[] = [
      anime({
        id: 1,
        title: '最近观看作品',
        originalTitle: 'Recent Anime',
        status: 'watching',
        progress: 3,
        totalEpisodes: 12,
        durationMinutes: 25,
        score: 8.5,
        cast: ['声优甲'],
        tags: ['日常', '治愈'],
        premiereDate: '2026-04-01',
        summary: '简介',
        updatedAt: '2026-07-27T01:00:00.000Z',
      }),
      anime({
        id: 2,
        title: '已完成作品',
        status: 'completed',
        progress: 12,
        totalEpisodes: 12,
        tags: ['日常'],
        premiereDate: '2025-01-01',
      }),
    ];
    const history: WatchHistoryRecord[] = [
      { id: 3, animeId: 1, animeTitle: '最近观看作品', episode: 3, watchedAt: '2026-07-27T02:00:00.000Z' },
      { id: 2, animeId: 2, animeTitle: '已完成作品', episode: 12, watchedAt: '2026-07-26T14:00:00.000Z' },
      { id: 1, animeId: 1, animeTitle: '最近观看作品', episode: 2, watchedAt: '2026-07-25T02:00:00.000Z' },
    ];

    const overview = buildDashboardOverview(
      animeList,
      history,
      new Date('2026-07-27T04:00:00.000Z'),
    );

    expect(overview.animeStats).toEqual({
      count: 2,
      episodesWatched: 15,
      minutesWatched: 363,
      byStatus: { watching: 1, completed: 1, dropped: 0, plan_to_watch: 0 },
    });
    expect(overview.animeCompletionRate).toBe(50);
    expect(overview.weeklyEpisodes).toBe(3);
    expect(overview.watchHours).toBe(6);
    expect(overview.heroAnime?.id).toBe(1);
    expect(overview.recentWatching.map((item) => item.anime.id)).toEqual([1, 2]);
    expect(overview.activityFeed.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(overview.activityByScale.week.totalEpisodes).toBe(3);
    expect(overview.activityByScale.month.totalEpisodes).toBe(3);
    expect(overview.activityByScale.year.totalEpisodes).toBe(3);
    expect(overview.activityByScale.week.data).toHaveLength(7);
    expect(overview.activityByScale.year.data).toHaveLength(12);
    expect(overview.tagBarData).toEqual([
      { tag: '日常', count: 2 },
      { tag: '治愈', count: 1 },
    ]);
    expect(overview.metadataCoverage).toEqual([
      { label: '原名', percent: 50 },
      { label: '评分', percent: 50 },
      { label: '集数', percent: 100 },
      { label: '声优', percent: 50 },
      { label: '首播', percent: 100 },
      { label: '简介', percent: 50 },
    ]);
    expect(overview.metadataRichness).toBe(50);
    expect(overview.premiereChart).toEqual([
      { label: '2025 年', value: 1 },
      { label: '2026 年', value: 1 },
    ]);
    expect(overview.recentPremiered.map((item) => item.id)).toEqual([1, 2]);
  });

  it('returns stable empty dashboard values', () => {
    const overview = buildDashboardOverview([], [], new Date('2026-07-27T04:00:00.000Z'));

    expect(overview.animeStats.count).toBe(0);
    expect(overview.animeCompletionRate).toBe(0);
    expect(overview.heroAnime).toBeNull();
    expect(overview.activityByScale.week.data).toHaveLength(7);
    expect(overview.activityByScale.week.totalEpisodes).toBe(0);
    expect(overview.tagBarMax).toBe(1);
  });
});
