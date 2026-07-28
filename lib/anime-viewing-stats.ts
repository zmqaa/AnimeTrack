import type { AnimeStatus } from './anime-shared';

const REWATCH_TAG_PATTERN = /^([0-9]{1,3}|[一二两三四五六七八九十]+)刷$/i;
const NON_PREFERENCE_TAGS = new Set(['TV', '漫改', '漫画改', '轻改', '轻小说改']);
const YEAR_TAG_PATTERN = /^(?:19|20)\d{2}$/;
const SEASON_TAG_PATTERN = /^(?:19|20)\d{2}年(?:1|4|7|10)月$/;

type ViewingRecord = {
  status: AnimeStatus;
  progress: number;
  durationMinutes?: number | null;
  tags?: string[] | null;
};

export type AnimeViewingStats = {
  libraryWorks: number;
  watchedWorks: number;
  completedWorks: number;
  watchingWorks: number;
  droppedWorks: number;
  plannedWorks: number;
  rewatchRuns: number;
  completedRewatchRuns: number;
  watchedEpisodes: number;
  rewatchEpisodes: number;
  totalMinutes: number;
};

export function isRewatchTag(tag: string): boolean {
  return REWATCH_TAG_PATTERN.test(tag.trim());
}

export function getRewatchTag(tags?: string[] | null): string | undefined {
  return tags?.map((tag) => tag.trim()).find(isRewatchTag);
}

export function isRewatchRecord(record: Pick<ViewingRecord, 'tags'>): boolean {
  return Boolean(getRewatchTag(record.tags));
}

export function getContentTags(tags?: string[] | null): string[] {
  return (tags || [])
    .map((tag) => tag.trim())
    .filter((tag) => (
      tag.length > 0
      && !isRewatchTag(tag)
      && !NON_PREFERENCE_TAGS.has(tag)
      && !YEAR_TAG_PATTERN.test(tag)
      && !SEASON_TAG_PATTERN.test(tag)
    ));
}

export function buildAnimeViewingStats(records: ViewingRecord[]): AnimeViewingStats {
  const stats: AnimeViewingStats = {
    libraryWorks: 0,
    watchedWorks: 0,
    completedWorks: 0,
    watchingWorks: 0,
    droppedWorks: 0,
    plannedWorks: 0,
    rewatchRuns: 0,
    completedRewatchRuns: 0,
    watchedEpisodes: 0,
    rewatchEpisodes: 0,
    totalMinutes: 0,
  };

  for (const record of records) {
    const progress = Number(record.progress) || 0;
    const duration = Number(record.durationMinutes) || 24;
    const rewatch = isRewatchRecord(record);

    stats.watchedEpisodes += progress;
    stats.totalMinutes += progress * duration;

    if (rewatch) {
      stats.rewatchRuns += 1;
      stats.rewatchEpisodes += progress;
      if (record.status === 'completed') stats.completedRewatchRuns += 1;
      continue;
    }

    stats.libraryWorks += 1;
    if (progress > 0 || record.status === 'completed' || record.status === 'dropped') {
      stats.watchedWorks += 1;
    }
    if (record.status === 'completed') stats.completedWorks += 1;
    if (record.status === 'watching') stats.watchingWorks += 1;
    if (record.status === 'dropped') stats.droppedWorks += 1;
    if (record.status === 'plan_to_watch') stats.plannedWorks += 1;
  }

  return stats;
}
