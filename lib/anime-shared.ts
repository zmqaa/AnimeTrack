export type AnimeStatus = 'watching' | 'completed' | 'dropped' | 'plan_to_watch';

export const ANIME_STATUS_LABELS: Record<AnimeStatus, string> = {
  watching: '追番中',
  completed: '已看完',
  dropped: '已弃坑',
  plan_to_watch: '计划看',
};

export type AnimeSortBy = 'lastWatchedAt' | 'updatedAt' | 'createdAt' | 'score' | 'progress' | 'title' | 'startDate' | 'endDate';

export interface SessionUser {
  role?: string;
}

export interface AnimeCardItem {
  id: number;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  localCoverUrl?: string;
  displayCoverUrl?: string;
  status: AnimeStatus;
  score?: number;
  progress: number;
  totalEpisodes?: number | null;
  durationMinutes?: number;
  notes?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  isFinished?: boolean;
  lastWatchedAt?: string;
}

export interface AnimeListItem extends AnimeCardItem {
  cast?: string[];
  castAliases?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AnimeDetailItem extends AnimeListItem {
  summary?: string;
  premiereDate?: string;
}

export interface AnimeFormInitialData {
  title?: string;
  originalTitle?: string;
  progress?: string | number;
  totalEpisodes?: string | number;
  status?: AnimeStatus;
  notes?: string;
  coverUrl?: string;
  localCoverUrl?: string;
  displayCoverUrl?: string;
  tags?: string;
  durationMinutes?: string | number;
  startDate?: string;
  endDate?: string;
  isFinished?: boolean;
}
