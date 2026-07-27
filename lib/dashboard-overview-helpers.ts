import type {
  AnimeRecord,
  DashboardActivityScale,
  DashboardActivityStats,
  DashboardAnimeItem,
  DashboardOverview,
  ParsedWatchHistory,
  WatchHistoryRecord,
} from './dashboard-types';
import { APP_TIME_ZONE, dateKeyToAppDate, formatAppDateKey, getAppDateTimeParts, shiftDateKey } from './date-utils';

function toDashboardAnimeItem(anime: AnimeRecord): DashboardAnimeItem {
  return {
    id: anime.id,
    title: anime.title,
    originalTitle: anime.originalTitle,
    displayCoverUrl: anime.displayCoverUrl,
    score: anime.score,
    premiereDate: anime.premiereDate,
    summary: anime.summary,
    updatedAt: anime.updatedAt,
    totalEpisodes: anime.totalEpisodes,
  };
}

function parseHistory(history: WatchHistoryRecord[]): ParsedWatchHistory[] {
  return history.map((record) => {
    const dateObj = new Date(record.watchedAt);
    const parts = getAppDateTimeParts(dateObj);
    return {
      ...record,
      dateObj,
      dateStr: formatAppDateKey(dateObj),
      hour: parts.hour,
      month: parts.month - 1,
      year: parts.year,
    };
  });
}

function buildActivityStats(
  scale: DashboardActivityScale,
  history: ParsedWatchHistory[],
  knownEpisodes: number,
  now: Date,
): DashboardActivityStats {
  const data: Array<{ label: string; value: number }> = [];
  const historyMap: Record<string, number> = {};
  for (const record of history) {
    historyMap[record.dateStr] = (historyMap[record.dateStr] || 0) + 1;
  }

  const todayKey = formatAppDateKey(now);
  const nowParts = getAppDateTimeParts(now);
  let scaleStart = dateKeyToAppDate(todayKey);

  if (scale === 'week') {
    const firstDayKey = shiftDateKey(todayKey, -6);
    scaleStart = dateKeyToAppDate(firstDayKey);
    for (let offset = 6; offset >= 0; offset -= 1) {
      const dateKey = shiftDateKey(todayKey, -offset);
      const date = dateKeyToAppDate(dateKey);
      data.push({
        label: date.toLocaleDateString('zh-CN', { weekday: 'short', timeZone: APP_TIME_ZONE }),
        value: historyMap[dateKey] || 0,
      });
    }
  } else if (scale === 'month') {
    const year = nowParts.year;
    const month = nowParts.month;
    const daysInMonth = new Date(year, month, 0).getDate();
    scaleStart = dateKeyToAppDate(`${year}-${String(month).padStart(2, '0')}-01`);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      data.push({ label: String(day), value: historyMap[dateKey] || 0 });
    }
  } else {
    const year = nowParts.year;
    const monthlyMap: Record<string, number> = {};
    scaleStart = dateKeyToAppDate(`${year}-01-01`);
    for (const record of history) {
      if (record.year !== year) continue;
      const monthKey = `${record.year}-${String(record.month + 1).padStart(2, '0')}`;
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
    }
    for (let month = 1; month <= 12; month += 1) {
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      data.push({ label: `${month}月`, value: monthlyMap[monthKey] || 0 });
    }
  }

  const totalEpisodes = data.reduce((sum, point) => sum + point.value, 0);
  const activeWindows: Record<string, number> = { '凌晨': 0, '日间': 0, '黄昏': 0, '深夜': 0 };
  for (const record of history) {
    if (record.dateObj < scaleStart) continue;
    if (record.hour < 6) activeWindows['凌晨'] += 1;
    else if (record.hour < 14) activeWindows['日间'] += 1;
    else if (record.hour < 20) activeWindows['黄昏'] += 1;
    else activeWindows['深夜'] += 1;
  }

  const mostActiveWindow = (Object.entries(activeWindows)
    .sort((left, right) => right[1] - left[1])[0] || ['暂无', 0]) as [string, number];
  const peakPoint = data.reduce(
    (peak, point) => point.value > peak.value ? point : peak,
    { label: '暂无', value: 0 },
  );

  return {
    data,
    totalEpisodes,
    totalMinutes: totalEpisodes * 24,
    title: scale === 'week' ? '过去 7 日趋势' : scale === 'month' ? '本月每日趋势' : '年度每月趋势',
    peakPoint,
    activeDays: data.filter((point) => point.value > 0).length,
    mostActiveWindow,
    libraryCoverage: knownEpisodes > 0
      ? Math.min(100, Math.round((totalEpisodes / knownEpisodes) * 100))
      : 0,
  };
}

export function buildDashboardOverview(
  animeList: AnimeRecord[],
  historyRecords: WatchHistoryRecord[],
  now = new Date(),
): DashboardOverview {
  const history = parseHistory(historyRecords);
  const animeById = new Map(animeList.map((anime) => [anime.id, anime]));
  const byStatus = {
    watching: 0,
    completed: 0,
    dropped: 0,
    plan_to_watch: 0,
  };
  const tagCounts = new Map<string, number>();
  let episodesWatched = 0;
  let minutesWatched = 0;
  let knownEpisodes = 0;
  let hasOriginalTitle = 0;
  let hasScore = 0;
  let hasTotalEpisodes = 0;
  let hasCast = 0;
  let hasPremiere = 0;
  let hasSummary = 0;
  let metadataRich = 0;
  const premiereYears = new Map<number, number>();
  const premiered: Array<{ anime: AnimeRecord; time: number }> = [];

  for (const anime of animeList) {
    episodesWatched += anime.progress;
    minutesWatched += anime.progress * (anime.durationMinutes || 24);
    knownEpisodes += anime.totalEpisodes ?? anime.progress;
    byStatus[anime.status] += 1;

    for (const tag of anime.tags || []) {
      const normalized = tag.trim();
      if (normalized) tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
    }

    if (anime.originalTitle) hasOriginalTitle += 1;
    if (typeof anime.score === 'number') hasScore += 1;
    if (typeof anime.totalEpisodes === 'number' && anime.totalEpisodes > 0) hasTotalEpisodes += 1;
    if (Array.isArray(anime.cast) && anime.cast.length > 0) hasCast += 1;
    if (anime.summary) hasSummary += 1;

    if (anime.premiereDate) {
      hasPremiere += 1;
      const premiereTime = new Date(anime.premiereDate).getTime();
      if (!Number.isNaN(premiereTime)) {
        const year = new Date(premiereTime).getFullYear();
        premiereYears.set(year, (premiereYears.get(year) || 0) + 1);
        premiered.push({ anime, time: premiereTime });
      }
    }

    const filledFields = [
      anime.originalTitle,
      anime.score,
      anime.totalEpisodes,
      Array.isArray(anime.cast) && anime.cast.length > 0 ? 1 : 0,
      anime.premiereDate,
      anime.summary,
    ].filter((value) => value !== undefined && value !== null && value !== '' && value !== 0);
    if (filledFields.length >= 4) metadataRich += 1;
  }

  let heroAnimeRecord = animeList[0] || null;
  for (const record of history) {
    const matched = animeById.get(record.animeId);
    if (matched) {
      heroAnimeRecord = matched;
      break;
    }
  }

  const recentWatching: DashboardOverview['recentWatching'] = [];
  const seenAnimeIds = new Set<number>();
  for (const record of history) {
    if (seenAnimeIds.has(record.animeId)) continue;
    const anime = animeById.get(record.animeId);
    if (!anime) continue;
    seenAnimeIds.add(record.animeId);
    recentWatching.push({ record, anime: toDashboardAnimeItem(anime) });
    if (recentWatching.length >= 9) break;
  }

  const activityByScale = {
    week: buildActivityStats('week', history, knownEpisodes, now),
    month: buildActivityStats('month', history, knownEpisodes, now),
    year: buildActivityStats('year', history, knownEpisodes, now),
  };
  const relevantTotal = byStatus.completed + byStatus.dropped + byStatus.watching;
  const totalForPercentage = animeList.length || 1;
  const tagBarData = Array.from(tagCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));

  return {
    animeStats: {
      count: animeList.length,
      episodesWatched,
      minutesWatched,
      byStatus,
    },
    animeCompletionRate: relevantTotal > 0
      ? Math.round((byStatus.completed / relevantTotal) * 100)
      : 0,
    weeklyEpisodes: activityByScale.week.totalEpisodes,
    watchHours: Math.round(minutesWatched / 60),
    heroAnime: heroAnimeRecord ? toDashboardAnimeItem(heroAnimeRecord) : null,
    activityByScale,
    premiereChart: Array.from(premiereYears.entries())
      .sort((left, right) => left[0] - right[0])
      .slice(-20)
      .map(([year, count]) => ({ label: `${year} 年`, value: count })),
    metadataCoverage: [
      { label: '原名', count: hasOriginalTitle },
      { label: '评分', count: hasScore },
      { label: '集数', count: hasTotalEpisodes },
      { label: '声优', count: hasCast },
      { label: '首播', count: hasPremiere },
      { label: '简介', count: hasSummary },
    ].map(({ label, count }) => ({
      label,
      percent: Math.round((count / totalForPercentage) * 100),
    })),
    metadataRichness: Math.round((metadataRich / totalForPercentage) * 100),
    tagBarData,
    tagBarMax: tagBarData.reduce((max, item) => Math.max(max, item.count), 1),
    recentPremiered: premiered
      .sort((left, right) => right.time - left.time)
      .slice(0, 6)
      .map(({ anime }) => toDashboardAnimeItem(anime)),
    recentWatching,
    activityFeed: historyRecords.slice(0, 15),
  };
}
