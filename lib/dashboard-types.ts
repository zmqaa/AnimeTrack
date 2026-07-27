import type { AnimeStatus, AnimeDetailItem } from './anime-shared';
import { ANIME_STATUS_LABELS } from './anime-shared';

// Re-export from shared to avoid duplicate type definitions
export type AnimeRecord = AnimeDetailItem;
export type { AnimeStatus };

export interface WatchHistoryRecord {
  id: number;
  animeId: number;
  animeTitle: string;
  episode: number;
  watchedAt: string;
}

export interface ParsedWatchHistory extends WatchHistoryRecord {
  dateObj: Date;
  dateStr: string;
  hour: number;
  month: number;
  year: number;
}

export type DashboardActivityScale = 'week' | 'month' | 'year';

export interface DashboardActivityStats {
  data: Array<{ label: string; value: number }>;
  totalEpisodes: number;
  totalMinutes: number;
  title: string;
  peakPoint: { label: string; value: number };
  activeDays: number;
  mostActiveWindow: [string, number];
  libraryCoverage: number;
}

export interface DashboardAnimeItem {
  id: number;
  title: string;
  originalTitle?: string;
  displayCoverUrl?: string;
  score?: number;
  premiereDate?: string;
  summary?: string;
  updatedAt: string;
  totalEpisodes?: number | null;
}

export interface DashboardOverview {
  animeStats: {
    count: number;
    episodesWatched: number;
    minutesWatched: number;
    byStatus: Record<AnimeStatus, number>;
  };
  animeCompletionRate: number;
  weeklyEpisodes: number;
  watchHours: number;
  heroAnime: DashboardAnimeItem | null;
  activityByScale: Record<DashboardActivityScale, DashboardActivityStats>;
  premiereChart: Array<{ label: string; value: number }>;
  metadataCoverage: Array<{ label: string; percent: number }>;
  metadataRichness: number;
  tagBarData: Array<{ tag: string; count: number }>;
  tagBarMax: number;
  recentPremiered: DashboardAnimeItem[];
  recentWatching: Array<{ record: WatchHistoryRecord; anime: DashboardAnimeItem }>;
  activityFeed: WatchHistoryRecord[];
}

/** @deprecated 使用 ANIME_STATUS_LABELS */
export const statusLabels = ANIME_STATUS_LABELS;
