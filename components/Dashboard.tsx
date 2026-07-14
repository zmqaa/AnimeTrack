'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline';
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
      // 线性扫描找最新记录（无需全量排序）
      let latest = parsedHistory[0];
      for (let i = 1; i < parsedHistory.length; i++) {
        if (parsedHistory[i].dateObj > latest.dateObj) latest = parsedHistory[i];
      }
      const anime = animeById.get(latest.animeId);
      if (anime) return anime;
    }
    return animeList[0] ?? null;
  }, [animeList, parsedHistory, animeById]);

  const recentWatching = useMemo(() => {
    const seenIds = new Set<number>();
    const items: Array<{ record: (typeof parsedHistory)[number]; anime?: AnimeRecord }> = [];
    // 线性扫描 + 手动维护 top-9（按 dateObj 降序），避免全量排序
    for (const record of parsedHistory) {
      // 跳过不存在的番剧（孤儿记录）
      const anime = animeById.get(record.animeId);
      if (!anime) continue;

      if (seenIds.has(record.animeId)) {
        // 同 anime 取最新一条记录
        const existingIdx = items.findIndex(item => item.record.animeId === record.animeId);
        if (existingIdx >= 0 && record.dateObj > items[existingIdx].record.dateObj) {
          items[existingIdx] = { record, anime };
        }
        continue;
      }
      seenIds.add(record.animeId);
      // 二分插入保持降序
      let lo = 0, hi = items.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (items[mid].record.dateObj >= record.dateObj) lo = mid + 1;
        else hi = mid;
      }
      items.splice(lo, 0, { record, anime });
      if (items.length > 9) items.pop();
    }
    return items;
  }, [animeList, parsedHistory, animeById]);

  // 合并 metadataCoverage / metadataRichness / premiereByYear / recentPremiered 为单次遍历
  const dashboardStats = useMemo(() => {
    const total = animeList.length || 1;
    let hasOriginalTitle = 0, hasScore = 0, hasTotalEp = 0, hasCast = 0, hasPremiere = 0, hasSummary = 0;
    let metadataRich = 0;
    const yearMap = new Map<number, number>();
    const premiered: Array<AnimeRecord & { _premiereTime: number }> = [];

    for (const a of animeList) {
      if (a.originalTitle) hasOriginalTitle++;
      if (typeof a.score === 'number') hasScore++;
      if (typeof a.totalEpisodes === 'number' && a.totalEpisodes > 0) hasTotalEp++;
      if (Array.isArray(a.cast) && a.cast.length > 0) hasCast++;
      if (a.summary) hasSummary++;

      if (a.premiereDate) {
        hasPremiere++;
        const d = new Date(a.premiereDate);
        if (!Number.isNaN(d.getTime())) {
          const year = d.getFullYear();
          yearMap.set(year, (yearMap.get(year) || 0) + 1);
          premiered.push({ ...a, _premiereTime: d.getTime() } as AnimeRecord & { _premiereTime: number });
        }
      }

      // metadataRichness: ≥4 fields filled
      const filledFields = [a.originalTitle, a.score, a.totalEpisodes,
        Array.isArray(a.cast) && a.cast.length > 0 ? 1 : 0,
        a.premiereDate, a.summary].filter((x) => x !== undefined && x !== null && x !== '' && x !== 0);
      if (filledFields.length >= 4) metadataRich++;
    }

    return {
      metadataCoverage: [
        { label: '原名', count: hasOriginalTitle },
        { label: '评分', count: hasScore },
        { label: '集数', count: hasTotalEp },
        { label: '声优', count: hasCast },
        { label: '首播', count: hasPremiere },
        { label: '简介', count: hasSummary },
      ].map((f) => ({ ...f, percent: Math.round((f.count / total) * 100) })),
      metadataRichness: Math.round((metadataRich / total) * 100),
      premiereByYear: Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0]).slice(-20)
        .map(([year, count]) => ({ year, count })),
      recentPremiered: premiered.sort((a, b) => b._premiereTime - a._premiereTime).slice(0, 6) as AnimeRecord[],
    };
  }, [animeList]);

  const premierePieData = useMemo(
    () => dashboardStats.premiereByYear.map((item, i) => ({
      label: `${item.year} 年`, value: item.count,
      color: themeDefinition.premierePalette[i % themeDefinition.premierePalette.length],
    })),
    [dashboardStats.premiereByYear, themeDefinition]
  );

  const tagBarData = useMemo(() => animeTagStats.slice(0, 8), [animeTagStats]);
  const tagBarMax = tagBarData.reduce((max, item) => Math.max(max, item.count), 1);

  const stats = [
    { label: '追番总数', value: animeStats.count.toString(), unit: '部', href: '/anime' },
    { label: '当前追番', value: (animeStats.byStatus.watching || 0).toString(), unit: '部', href: '/anime?status=watching' },
    { label: '本周观看', value: weeklyEpisodes.toString(), unit: '集', href: '/anime/timeline' },
    { label: '看番总时长', value: Math.round(animeStats.minutesWatched / 60).toString(), unit: '小时', prefix: '约' },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-4 lg:space-y-6 animate-fade-in pb-20 relative">
      <div className="theme-dashboard-aura absolute inset-0 pointer-events-none opacity-40" />
      <DashboardHeader isLoading={isLoading} isRefreshing={isRefreshing} />

      {/* Hero */}
      <LazyRender fallback={<div className="glass-panel-strong rounded-[34px] h-[330px] animate-pulse" />}>
        <DashboardHeroCard
          animeStats={animeStats} metadataRichness={dashboardStats.metadataRichness}
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
            <div className="glass-panel p-6 lg:p-7 rounded-[32px] bg-gradient-to-br from-[var(--bg-card)]/40 via-transparent to-transparent min-h-[420px]">
              <AdvancedActivityStats history={parsedHistory} animeList={animeList} />
            </div>
          </LazyRender>

          <LazyRender fallback={<div className="glass-panel rounded-[32px] h-[300px] animate-pulse" />}>
            <div className="glass-panel p-6 lg:p-7 rounded-[32px] flex flex-col overflow-visible">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDaysIcon className="w-4 h-4 text-[var(--color-airing)]" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)]">作品开播时间分布</h2>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mb-2">基于每部作品的开播日期字段统计</p>
              {premierePieData.length > 0 ? (
                <div className="flex-1 w-full min-h-[220px] mt-2 pb-2">
                  <YearBarChart data={premierePieData} height={220} />
                </div>
              ) : (
                <div className="flex-1 flex items-center"><div className="text-sm text-[var(--text-muted)]">开播日期字段还不够多，先在详情页补全几部作品即可生成分布。</div></div>
              )}
            </div>
          </LazyRender>

          {/* Recent Watching */}
          <div className="glass-panel p-6 lg:p-7 rounded-[32px] flex flex-col">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-[var(--color-airing)]" />最近在看作品
              </h2>
              <Link href="/anime/timeline" className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-widest">查看时间线</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4 auto-rows-max content-start pr-1">
              {recentWatching.map(({ record, anime }) => (
                <Link key={`recent-${record.id}`} href={`/anime/${record.animeId}`}
                  className="group surface-card-muted rounded-[22px] overflow-hidden hover:border-[var(--color-airing-border)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01]">
                  <div className="aspect-video w-full bg-[var(--tag-bg)]/70 bg-cover bg-center"
                    style={anime?.coverUrl ? { backgroundImage: `linear-gradient(180deg, var(--color-cover-gradient-start), var(--color-cover-gradient-end)), url(${anime.coverUrl})` } : undefined} />
                  <div className="p-4">
                    <div className="mt-1 text-base text-[var(--text-primary)] truncate">{anime?.title ?? record.animeTitle}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{anime?.originalTitle ?? '来自观看历史'}</div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full badge-airing-soft border px-2.5 py-1 text-[11px]">第 {record.episode} 集</span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">{formatWatchMoment(record.dateObj)}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {Array.from({ length: Math.max(0, 9 - recentWatching.length) }).map((_, i) => (
                <div key={`recent-empty-${i}`} className="surface-card-muted rounded-[22px] overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-[var(--color-surface-raised)] to-transparent" />
                  <div className="p-4"><div className="mt-2 text-sm text-[var(--text-muted)]">最近看得太少啦~</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-5">
          <LazyRender fallback={<div className="glass-panel rounded-[32px] h-64 animate-pulse" />}>
            <DashboardRightPanel
              metadataCoverage={dashboardStats.metadataCoverage} metadataRichness={dashboardStats.metadataRichness}
              tagBarData={tagBarData} tagBarMax={tagBarMax}
              recentPremiered={dashboardStats.recentPremiered}
            />
          </LazyRender>

          {/* Activity Feed */}
          <div className="glass-panel p-6 lg:p-7 rounded-[32px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full glow-watching" />最近记录
              </h2>
              <Link href="/anime/timeline" className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">查看全部</Link>
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
