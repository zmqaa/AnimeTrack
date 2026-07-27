import type { AnimeStatus } from './anime-shared';
import type { WatchHistoryRecord } from './dashboard-types';

export type TimelineSortBy = 'newest' | 'oldest' | 'mostEpisodes';
export type TimelineActivityScale = 'week' | 'month' | 'year';

export interface TimelineAnimeItem {
  id: number;
  title: string;
  originalTitle?: string;
  status: AnimeStatus;
  totalEpisodes?: number | null;
  displayCoverUrl?: string;
  thumbnailCoverUrl?: string;
}

export interface TimelineEntry {
  history: WatchHistoryRecord;
  anime?: TimelineAnimeItem;
}

export interface TimelineStatsData {
  totalEpisodes: number;
  uniqueAnime: number;
  activeDays: number;
  avgEpisodesPerDay: string;
  peakPeriod: string;
  peakPeriodCount: number;
  withCover: number;
}

export interface TimelineActivityData {
  data: Array<{ label: string; value: number }>;
  totalEpisodes: number;
  peakPoint: { label: string; value: number };
  activeDays: number;
  coveragePercent: number;
}

export interface TimelineAnimeSummaryData {
  animeId: number;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  status: AnimeStatus;
  totalWatched: number;
  latestEpisode: number;
  lastEpisode: number;
  totalEpisodes?: number | null;
  firstWatched: string;
  lastWatched: string;
  sessionCount: number;
}

export interface TimelineOverview {
  stats: TimelineStatsData;
  activityByScale: Record<TimelineActivityScale, TimelineActivityData>;
  heatmap: {
    months: number;
    dailyCounts: Record<string, number>;
  };
  animeSummary: TimelineAnimeSummaryData[];
}

export interface TimelineEntriesResponse {
  records: TimelineEntry[];
  summary?: TimelineAnimeSummaryData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
