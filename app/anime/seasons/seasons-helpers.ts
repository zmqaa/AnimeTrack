import type { AnimeRecord } from '@/lib/dashboard-types';
import { formatShortDate } from '@/lib/formatters';

export type SeasonName = '1月' | '4月' | '7月' | '10月';

export function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function parsePremiere(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return startOfDay(date);
}

export function seasonFromMonth(month: number): { season: SeasonName; seasonOrder: number } {
  if (month <= 2) return { season: '1月', seasonOrder: 0 };
  if (month <= 5) return { season: '4月', seasonOrder: 1 };
  if (month <= 8) return { season: '7月', seasonOrder: 2 };
  return { season: '10月', seasonOrder: 3 };
}

export function hasStartedWatching(anime: AnimeRecord) {
  return Boolean(anime.lastWatchedAt) || Boolean(anime.startDate) || Boolean(anime.endDate) || anime.progress > 0 || anime.status === 'watching' || anime.status === 'completed';
}

export function getSeasonPremiere(anime: AnimeRecord, referenceDate: Date) {
  const premiere = parsePremiere(anime.premiereDate);
  if (!premiere) return null;
  return premiere.getTime() > referenceDate.getTime() ? null : premiere;
}

function toDateValue(value?: string) {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

export function compareDateDesc(left?: string, right?: string) {
  const leftTime = toDateValue(left);
  const rightTime = toDateValue(right);
  const leftMissing = Number.isNaN(leftTime);
  const rightMissing = Number.isNaN(rightTime);

  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return rightTime - leftTime;
}

export function compareSeasonAnime(left: AnimeRecord, right: AnimeRecord) {
  const watchCompare = compareDateDesc(left.lastWatchedAt, right.lastWatchedAt);
  if (watchCompare !== 0) return watchCompare;

  const startedCompare = Number(hasStartedWatching(right)) - Number(hasStartedWatching(left));
  if (startedCompare !== 0) return startedCompare;

  const progressCompare = (right.progress || 0) - (left.progress || 0);
  if (progressCompare !== 0) return progressCompare;

  const scoreCompare = (right.score || 0) - (left.score || 0);
  if (scoreCompare !== 0) return scoreCompare;

  return left.title.localeCompare(right.title, 'zh-CN');
}

export function formatSeasonLastWatchLabel(bucket: { lastWatchedAt?: string; started: number }) {
  if (bucket.lastWatchedAt) {
    return formatShortDate(bucket.lastWatchedAt);
  }
  return bucket.started > 0 ? '无记录' : '未触达';
}

export function formatAnimeWatchState(anime: AnimeRecord) {
  if (anime.lastWatchedAt) {
    return `最近观看 ${formatShortDate(anime.lastWatchedAt)}`;
  }
  if (anime.status === 'completed' || Boolean(anime.endDate)) {
    return '已看完，缺少时间记录';
  }
  if (hasStartedWatching(anime)) {
    return '已开始追番，缺少时间记录';
  }
  return '还没开始追';
}
