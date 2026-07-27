import type { WatchHistoryRecord } from './dashboard-types';
import {
  APP_TIME_ZONE,
  dateKeyToAppDate,
  formatAppDateKey,
  getAppDateTimeParts,
  shiftDateKey,
} from './date-utils';
import type {
  TimelineActivityData,
  TimelineActivityScale,
  TimelineAnimeItem,
  TimelineAnimeSummaryData,
  TimelineOverview,
} from './timeline-types';

export type TimelineOverviewAnime = TimelineAnimeItem;

function buildActivityData(
  scale: TimelineActivityScale,
  historyMap: Record<string, number>,
  parsedHistory: Array<{ dateStr: string; month: number; year: number }>,
  now: Date,
): TimelineActivityData {
  const data: Array<{ label: string; value: number }> = [];
  const todayKey = formatAppDateKey(now);
  const nowParts = getAppDateTimeParts(now);

  if (scale === 'week') {
    for (let offset = 6; offset >= 0; offset -= 1) {
      const dateKey = shiftDateKey(todayKey, -offset);
      data.push({
        label: dateKeyToAppDate(dateKey).toLocaleDateString('zh-CN', {
          weekday: 'short',
          timeZone: APP_TIME_ZONE,
        }),
        value: historyMap[dateKey] || 0,
      });
    }
  } else if (scale === 'month') {
    const daysInMonth = new Date(nowParts.year, nowParts.month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      data.push({ label: String(day), value: historyMap[dateKey] || 0 });
    }
  } else {
    const monthlyMap: Record<string, number> = {};
    for (const record of parsedHistory) {
      if (record.year !== nowParts.year) continue;
      const monthKey = `${record.year}-${String(record.month).padStart(2, '0')}`;
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
    }
    for (let month = 1; month <= 12; month += 1) {
      const monthKey = `${nowParts.year}-${String(month).padStart(2, '0')}`;
      data.push({ label: `${month}月`, value: monthlyMap[monthKey] || 0 });
    }
  }

  const totalEpisodes = data.reduce((sum, point) => sum + point.value, 0);
  const peakPoint = data.reduce(
    (peak, point) => point.value > peak.value ? point : peak,
    { label: '暂无', value: 0 },
  );
  const activeDays = data.filter((point) => point.value > 0).length;

  return {
    data,
    totalEpisodes,
    peakPoint,
    activeDays,
    coveragePercent: data.length > 0 ? Math.round((activeDays / data.length) * 100) : 0,
  };
}

export function buildTimelineAnimeSummary(
  animeList: TimelineOverviewAnime[],
  history: WatchHistoryRecord[],
): TimelineAnimeSummaryData[] {
  const animeMap = new Map(animeList.map((anime) => [anime.id, anime]));
  const summaries = new Map<number, TimelineAnimeSummaryData>();
  const latestRecords = new Map<number, { watchedAt: string; id: number }>();

  for (const record of history) {
    const anime = animeMap.get(record.animeId);
    let summary = summaries.get(record.animeId);
    if (!summary) {
      summary = {
        animeId: record.animeId,
        title: record.animeTitle,
        originalTitle: anime?.originalTitle,
        coverUrl: anime?.displayCoverUrl,
        status: anime?.status ?? 'watching',
        totalWatched: 0,
        latestEpisode: 0,
        lastEpisode: record.episode,
        totalEpisodes: anime?.totalEpisodes,
        firstWatched: record.watchedAt,
        lastWatched: record.watchedAt,
        sessionCount: 0,
      };
      summaries.set(record.animeId, summary);
      latestRecords.set(record.animeId, { watchedAt: record.watchedAt, id: record.id });
    }

    summary.totalWatched += 1;
    summary.sessionCount += 1;
    summary.latestEpisode = Math.max(summary.latestEpisode, record.episode);
    if (record.watchedAt < summary.firstWatched) summary.firstWatched = record.watchedAt;
    const latestRecord = latestRecords.get(record.animeId);
    if (!latestRecord
        || record.watchedAt > latestRecord.watchedAt
        || (record.watchedAt === latestRecord.watchedAt && record.id > latestRecord.id)) {
      summary.lastWatched = record.watchedAt;
      summary.lastEpisode = record.episode;
      latestRecords.set(record.animeId, { watchedAt: record.watchedAt, id: record.id });
    }
  }

  return Array.from(summaries.values()).sort(
    (left, right) => right.lastWatched.localeCompare(left.lastWatched)
      || (latestRecords.get(right.animeId)?.id ?? 0) - (latestRecords.get(left.animeId)?.id ?? 0)
      || left.animeId - right.animeId,
  );
}

export function buildTimelineOverview(
  animeList: TimelineOverviewAnime[],
  history: WatchHistoryRecord[],
  now = new Date(),
  heatmapMonths = 12,
): TimelineOverview {
  const animeMap = new Map(animeList.map((anime) => [anime.id, anime]));
  const uniqueAnimeIds = new Set<number>();
  const activeDateKeys = new Set<string>();
  const historyMap: Record<string, number> = {};
  const periodCounts: Record<string, number> = { '凌晨': 0, '日间': 0, '黄昏': 0, '深夜': 0 };
  const parsedHistory: Array<{ dateStr: string; month: number; year: number }> = [];

  for (const record of history) {
    const parts = getAppDateTimeParts(record.watchedAt);
    const dateStr = formatAppDateKey(record.watchedAt);
    parsedHistory.push({ dateStr, month: parts.month, year: parts.year });
    uniqueAnimeIds.add(record.animeId);
    activeDateKeys.add(dateStr);
    historyMap[dateStr] = (historyMap[dateStr] || 0) + 1;

    if (parts.hour < 6) periodCounts['凌晨'] += 1;
    else if (parts.hour < 14) periodCounts['日间'] += 1;
    else if (parts.hour < 20) periodCounts['黄昏'] += 1;
    else periodCounts['深夜'] += 1;
  }

  const activeDays = activeDateKeys.size || 1;
  const peakPeriod = Object.entries(periodCounts).sort((left, right) => right[1] - left[1])[0];
  let withCover = 0;
  for (const animeId of uniqueAnimeIds) {
    if (animeMap.get(animeId)?.displayCoverUrl) withCover += 1;
  }

  const todayParts = getAppDateTimeParts(now);
  const heatmapStart = new Date(Date.UTC(todayParts.year, todayParts.month - 1 - heatmapMonths, 1));
  const heatmapStartKey = `${heatmapStart.getUTCFullYear()}-${String(heatmapStart.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const heatmapStartDay = heatmapStart.getUTCDay();
  const heatmapMondayKey = shiftDateKey(
    heatmapStartKey,
    heatmapStartDay === 0 ? -6 : 1 - heatmapStartDay,
  );
  const heatmapCounts = Object.fromEntries(
    Object.entries(historyMap).filter(([dateKey]) => dateKey >= heatmapMondayKey),
  );

  return {
    stats: {
      totalEpisodes: history.length,
      uniqueAnime: uniqueAnimeIds.size,
      activeDays,
      avgEpisodesPerDay: (history.length / activeDays).toFixed(1),
      peakPeriod: peakPeriod?.[0] ?? '暂无',
      peakPeriodCount: peakPeriod?.[1] ?? 0,
      withCover,
    },
    activityByScale: {
      week: buildActivityData('week', historyMap, parsedHistory, now),
      month: buildActivityData('month', historyMap, parsedHistory, now),
      year: buildActivityData('year', historyMap, parsedHistory, now),
    },
    heatmap: {
      months: heatmapMonths,
      dailyCounts: heatmapCounts,
    },
    animeSummary: buildTimelineAnimeSummary(animeList, history),
  };
}
