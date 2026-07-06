'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import {
  ArrowTrendingUpIcon, CalendarDaysIcon, ClockIcon,
  FireIcon, TvIcon,
} from '@heroicons/react/24/outline';
import { useAnimeData } from '@/hooks/useAnimeData';
import { useHistoryData } from '@/hooks/useHistoryData';
import { useTheme } from '@/components/theme/ThemeProvider';
import { AnimeRecord } from '@/lib/dashboard-types';
import { formatWatchMoment } from '@/lib/formatters';
import { getAppThemeDefinition } from '@/lib/theme';
import DashboardHeader from './dashboard/DashboardHeader';
import DashboardHeroCard from './dashboard/DashboardHeroCard';
import DashboardStatCards from './dashboard/DashboardStatCards';
import DashboardRightPanel from './dashboard/DashboardRightPanel';
import LazyRender from './shared/LazyRender';

const YearBarChart = dynamic(() => import('./dashboard/YearBarChart').then(mod => mod.YearBarChart), { ssr: false });
const ActivityFeed = dynamic(() => import('./dashboard/ActivityFeed'), { ssr: false });
const AdvancedActivityStats = dynamic(() => import('./dashboard/AdvancedActivityStats'), { ssr: false });

export default function Dashboard() {
  const { theme } = useTheme();
  const themeDefinition = getAppThemeDefinition(theme);
  const { parsedHistory, isLoading: hLoading, isRefreshing: hRefreshing } = useHistoryData();
  const { animeList, animeStats, animeTagStats, animeCompletionRate,
    isLoading: aLoading, isRefreshing: aRefreshing } = useAnimeData(parsedHistory);

  const isLoading = aLoading || hLoading;
  const isRefreshing = aRefreshing || hRefreshing;

  const weeklyEpisodes = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    return parsedHistory.filter((h) => h.dateObj >= sevenDaysAgo).length;
  }, [parsedHistory]);

  // 共享的 animeId → record 映射，避免多个 useMemo 重复构建
  const animeById = useMemo(
    () => new Map(animeList.map((a) => [a.id, a])),
    [animeList]
  );

  const heroAnime = useMemo(() => {
    if (parsedHistory.length) {
      const sorted = [...parsedHistory].sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      for (const record of sorted) {
        const anime = animeById.get(record.animeId);
        if (anime) return anime;
      }
    }
    return animeList[0] ?? null;
  }, [animeList, parsedHistory, animeById]);

  const recentWatching = useMemo(() => {
    const seenIds = new Set<number>();
    const items: Array<{ record: (typeof parsedHistory)[number]; anime?: AnimeRecord }> = [];
    for (const record of [...parsedHistory].sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())) {
      if (seenIds.has(record.animeId)) continue;
      seenIds.add(record.animeId);
      items.push({ record, anime: animeById.get(record.animeId) });
      if (items.length >= 9) break;
    }
    return items;
  }, [animeList, parsedHistory, animeById]);

  const metadataCoverage = useMemo(() => {
    const total = animeList.length || 1;
    return [
      { label: '原名', count: animeList.filter((a) => Boolean(a.originalTitle)).length },
      { label: '评分', count: animeList.filter((a) => typeof a.score === 'number').length },
      { label: '集数', count: animeList.filter((a) => typeof a.totalEpisodes === 'number' && a.totalEpisodes > 0).length },
      { label: '声优', count: animeList.filter((a) => Array.isArray(a.cast) && a.cast.length > 0).length },
      { label: '首播', count: animeList.filter((a) => Boolean(a.premiereDate)).length },
      { label: '简介', count: animeList.filter((a) => Boolean(a.summary)).length },
    ].map((f) => ({ ...f, percent: Math.round((f.count / total) * 100) }));
  }, [animeList]);

  const metadataRichness = useMemo(() => {
    if (!animeList.length) return 0;
    const filled = animeList.filter((a) => {
      const v = [a.originalTitle, a.score, a.totalEpisodes,
        Array.isArray(a.cast) && a.cast.length > 0 ? a.cast.join(',') : undefined,
        a.premiereDate, a.summary].filter((x) => x !== undefined && x !== null && x !== '');
      return v.length >= 4;
    }).length;
    return Math.round((filled / animeList.length) * 100);
  }, [animeList]);

  const premiereByYear = useMemo(() => {
    const map = new Map<number, number>();
    animeList.forEach((a) => {
      if (!a.premiereDate) return;
      const d = new Date(a.premiereDate);
      if (Number.isNaN(d.getTime())) return;
      const year = d.getFullYear();
      map.set(year, (map.get(year) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).slice(-20)
      .map(([year, count]) => ({ year, count }));
  }, [animeList]);

  const premierePieData = useMemo(
    () => premiereByYear.map((item, i) => ({
      label: `${item.year} 年`, value: item.count,
      color: themeDefinition.premierePalette[i % themeDefinition.premierePalette.length],
    })),
    [premiereByYear, themeDefinition]
  );

  const tagBarData = useMemo(() => animeTagStats.slice(0, 8), [animeTagStats]);
  const tagBarMax = tagBarData.reduce((max, item) => Math.max(max, item.count), 1);

  const recentPremiered = useMemo(() => {
    return [...animeList]
      .filter((a) => a.premiereDate)
      .sort((a, b) => new Date(b.premiereDate ?? 0).getTime() - new Date(a.premiereDate ?? 0).getTime())
      .slice(0, 6);
  }, [animeList]);

  const stats = [
    { label: '追番总数', value: animeStats.count.toString(), unit: '部', icon: TvIcon, color: 'theme-accent-text', href: '/anime' },
    { label: '当前追番', value: (animeStats.byStatus.watching || 0).toString(), unit: '部', icon: FireIcon, color: 'text-amber-300', href: '/anime?status=watching' },
    { label: '本周观看', value: weeklyEpisodes.toString(), unit: '集', icon: ClockIcon, color: 'text-sky-300', href: '/anime/timeline' },
    { label: '看番总时长', value: Math.round(animeStats.minutesWatched / 60).toString(), unit: '小时', prefix: '约', icon: ArrowTrendingUpIcon, color: 'theme-secondary-text' },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-4 lg:space-y-6 animate-fade-in pb-20 relative">
      <div className="theme-dashboard-aura absolute inset-0 pointer-events-none opacity-40" />
      <DashboardHeader isLoading={isLoading} isRefreshing={isRefreshing} />

      {/* Hero */}
      <LazyRender fallback={<div className="glass-panel-strong rounded-[34px] h-[330px] animate-pulse" />}>
        <DashboardHeroCard
          animeStats={animeStats} metadataRichness={metadataRichness}
          animeCompletionRate={animeCompletionRate} weeklyEpisodes={weeklyEpisodes}
          heroAnime={heroAnime} themeDefinition={themeDefinition}
        />
      </LazyRender>

      {/* Stat Cards */}
      <LazyRender fallback={<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="glass-panel rounded-[24px] h-28 animate-pulse" />))}</div>}>
        <DashboardStatCards stats={stats} />
      </LazyRender>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 relative z-10">
        {/* Left (main) column */}
        <div className="lg:col-span-8 flex flex-col gap-4 lg:gap-5">
          <LazyRender fallback={<div className="glass-panel rounded-[32px] h-96 animate-pulse" />}>
            <div className="glass-panel p-6 lg:p-7 rounded-[32px] bg-gradient-to-br from-zinc-900/40 via-transparent to-transparent min-h-[420px]">
              <AdvancedActivityStats history={parsedHistory} animeList={animeList} />
            </div>
          </LazyRender>

          <LazyRender fallback={<div className="glass-panel rounded-[32px] h-[300px] animate-pulse" />}>
            <div className="glass-panel p-6 lg:p-7 rounded-[32px] flex flex-col overflow-visible">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDaysIcon className="w-4 h-4 text-sky-300" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-300">作品开播时间分布</h2>
              </div>
              <p className="text-[10px] text-zinc-600 mb-2">基于每部作品的开播日期字段统计</p>
              {premierePieData.length > 0 ? (
                <div className="flex-1 w-full min-h-[220px] mt-2 pb-2">
                  <YearBarChart data={premierePieData} height={220} />
                </div>
              ) : (
                <div className="flex-1 flex items-center"><div className="text-sm text-zinc-500">开播日期字段还不够多，先在详情页补全几部作品即可生成分布。</div></div>
              )}
            </div>
          </LazyRender>

          {/* Recent Watching */}
          <div className="glass-panel p-6 lg:p-7 rounded-[32px] flex flex-col">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-sky-300" />最近在看作品
              </h2>
              <Link href="/anime/timeline" className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest">查看时间线</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4 auto-rows-max content-start pr-1">
              {recentWatching.map(({ record, anime }) => (
                <Link key={`recent-${record.id}`} href={`/anime/${record.animeId}`}
                  className="group surface-card-muted rounded-[22px] overflow-hidden hover:border-sky-300/20 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01]">
                  <div className="aspect-video w-full bg-zinc-900/70 bg-cover bg-center"
                    style={anime?.coverUrl ? { backgroundImage: `linear-gradient(180deg, rgba(7,17,15,0.1), rgba(7,17,15,0.9)), url(${anime.coverUrl})` } : undefined} />
                  <div className="p-4">
                    <div className="mt-1 text-base text-zinc-100 truncate">{anime?.title ?? record.animeTitle}</div>
                    <div className="text-xs text-zinc-500 truncate">{anime?.originalTitle ?? '来自观看历史'}</div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[11px] text-sky-100">第 {record.episode} 集</span>
                      <span className="text-[11px] text-zinc-500 font-mono">{formatWatchMoment(record.dateObj)}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {Array.from({ length: Math.max(0, 9 - recentWatching.length) }).map((_, i) => (
                <div key={`recent-empty-${i}`} className="surface-card-muted rounded-[22px] overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-white/[0.04] to-transparent" />
                  <div className="p-4"><div className="mt-2 text-sm text-zinc-500">最近看得太少啦~</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-5">
          <LazyRender fallback={<div className="glass-panel rounded-[32px] h-64 animate-pulse" />}>
            <DashboardRightPanel
              metadataCoverage={metadataCoverage} metadataRichness={metadataRichness}
              tagBarData={tagBarData} tagBarMax={tagBarMax}
              recentPremiered={recentPremiered}
            />
          </LazyRender>

          {/* Activity Feed */}
          <div className="glass-panel p-6 lg:p-7 rounded-[32px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" />最近记录
              </h2>
              <Link href="/anime/timeline" className="text-[10px] font-bold text-zinc-600 hover:text-white transition-colors">查看全部</Link>
            </div>
            <div className="max-h-[480px] lg:max-h-[430px] xl:max-h-[380px] overflow-y-auto pr-2 overscroll-contain">
              <ActivityFeed history={parsedHistory} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
