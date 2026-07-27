import { describe, expect, it } from 'vitest';

import {
  buildTimelineAnimeSummary,
  buildTimelineOverview,
} from '../../lib/timeline-overview-helpers';
import type { WatchHistoryRecord } from '../../lib/dashboard-types';
import type { TimelineOverviewAnime } from '../../lib/timeline-overview-helpers';

const animeList: TimelineOverviewAnime[] = [
  {
    id: 1,
    title: '作品一',
    originalTitle: 'Anime One',
    status: 'watching',
    totalEpisodes: 12,
    displayCoverUrl: '/cover-1.jpg',
  },
  {
    id: 2,
    title: '作品二',
    status: 'completed',
    totalEpisodes: 3,
  },
];

const history: WatchHistoryRecord[] = [
  { id: 4, animeId: 1, animeTitle: '作品一', episode: 3, watchedAt: '2026-07-27T15:30:00.000Z' },
  { id: 3, animeId: 2, animeTitle: '作品二', episode: 3, watchedAt: '2026-07-27T11:00:00.000Z' },
  { id: 2, animeId: 1, animeTitle: '作品一', episode: 2, watchedAt: '2026-07-26T06:00:00.000Z' },
  { id: 1, animeId: 1, animeTitle: '作品一', episode: 1, watchedAt: '2026-07-25T01:00:00.000Z' },
];

describe('timeline overview aggregation', () => {
  it('builds cards, three activity scales and heatmap counts in app time', () => {
    const overview = buildTimelineOverview(
      animeList,
      history,
      new Date('2026-07-27T16:30:00.000Z'),
    );

    expect(overview.stats).toEqual({
      totalEpisodes: 4,
      uniqueAnime: 2,
      activeDays: 3,
      avgEpisodesPerDay: '1.3',
      peakPeriod: '黄昏',
      peakPeriodCount: 2,
      withCover: 1,
    });
    expect(overview.activityByScale.week.totalEpisodes).toBe(4);
    expect(overview.activityByScale.month.totalEpisodes).toBe(4);
    expect(overview.activityByScale.year.totalEpisodes).toBe(4);
    expect(overview.activityByScale.week.data).toHaveLength(7);
    expect(overview.activityByScale.month.data).toHaveLength(31);
    expect(overview.activityByScale.year.data).toHaveLength(12);
    expect(overview.heatmap.dailyCounts).toMatchObject({
      '2026-07-25': 1,
      '2026-07-26': 1,
      '2026-07-27': 2,
    });
  });

  it('keeps the existing empty-history card semantics', () => {
    const overview = buildTimelineOverview([], [], new Date('2026-07-27T04:00:00.000Z'));

    expect(overview.stats.activeDays).toBe(1);
    expect(overview.stats.avgEpisodesPerDay).toBe('0.0');
    expect(overview.stats.peakPeriod).toBe('凌晨');
    expect(overview.activityByScale.week.totalEpisodes).toBe(0);
    expect(overview.animeSummary).toEqual([]);
  });

  it('summarizes all matching history instead of only one result page', () => {
    const summaries = buildTimelineAnimeSummary(animeList, history);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      animeId: 1,
      totalWatched: 3,
      latestEpisode: 3,
      lastEpisode: 3,
      firstWatched: '2026-07-25T01:00:00.000Z',
      lastWatched: '2026-07-27T15:30:00.000Z',
      coverUrl: '/cover-1.jpg',
    });
    expect(summaries[1]).toMatchObject({
      animeId: 2,
      totalWatched: 1,
      latestEpisode: 3,
      lastEpisode: 3,
    });
  });
});
