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

/** @deprecated 使用 ANIME_STATUS_LABELS */
export const statusLabels = ANIME_STATUS_LABELS;

export const statusColors: Record<AnimeStatus, string> = {
  watching: '#22c55e',
  completed: '#10b981',
  dropped: '#ef4444',
  plan_to_watch: '#8b5cf6',
};
