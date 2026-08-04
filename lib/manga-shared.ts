export type MangaReadingStatus =
  | 'plan_to_read'
  | 'reading'
  | 'caught_up'
  | 'completed'
  | 'paused'
  | 'dropped';

export type MangaPublicationStatus = 'ongoing' | 'completed' | 'hiatus' | 'unknown';

export interface MangaRecord {
  id: number;
  bangumiId?: number;
  title: string;
  originalTitle?: string;
  aliases: string[];
  coverUrl?: string;
  status: MangaReadingStatus;
  publicationStatus: MangaPublicationStatus;
  score?: number;
  currentVolume?: string;
  currentChapter?: string;
  totalVolumes?: number;
  totalChapters?: number;
  notes?: string;
  tags: string[];
  summary?: string;
  authors: string[];
  illustrators: string[];
  publishers: string[];
  serializations: string[];
  startDate?: string;
  endDate?: string;
  releaseDate?: string;
  createdAt: string;
  updatedAt: string;
}

export const MANGA_READING_STATUS_LABELS: Record<MangaReadingStatus, string> = {
  plan_to_read: '想读',
  reading: '阅读中',
  caught_up: '已追到最新',
  completed: '已读完',
  paused: '搁置',
  dropped: '弃读',
};

export const MANGA_PUBLICATION_STATUS_LABELS: Record<MangaPublicationStatus, string> = {
  ongoing: '连载中',
  completed: '已完结',
  hiatus: '休载中',
  unknown: '连载状态未知',
};

