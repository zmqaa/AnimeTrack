'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useAnimeData } from '@/hooks/useAnimeData';
import { useHistoryData } from '@/hooks/useHistoryData';
import { AnimeRecord } from '@/lib/dashboard-types';
import { formatWatchMoment } from '@/lib/formatters';
import DashboardHeroCard from './dashboard/DashboardHeroCard';
import DashboardRightPanel from './dashboard/DashboardRightPanel';
import LazyRender from './shared/LazyRender';
import Panel from './shared/Panel';
import { PanelSkeleton } from './shared/Skeleton';

const YearBarChart = dynamic(() => import('./dashboard/YearBarChart').then(mod => mod.YearBarChart), { ssr: false });
const ActivityFeed = dynamic(() => import('./dashboard/ActivityFeed'), { ssr: false });
const AdvancedActivityStats = dynamic(() => import('./dashboard/AdvancedActivityStats'), { ssr: false });

export default function Dashboard() {
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
  }, [parsedHistory, animeById]);

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
    () => dashboardStats.premiereByYear.map((item) => ({
      label: `${item.year} 年`, value: item.count,
    })),
    [dashboardStats.premiereByYear]
  );

  const tagBarData = useMemo(() => animeTagStats.slice(0, 8), [animeTagStats]);
  const tagBarMax = tagBarData.reduce((max, item) => Math.max(max, item.count), 1);

  return (
    <div className="p-4 lg:p-8 space-y-4 lg:space-y-6 animate-fade-in pb-20 relative">
      <div className="theme-dashboard-aura absolute inset-0 pointer-events-none opacity-40" />
      {/* Hero */}
      <LazyRender fallback={<PanelSkeleton surface="strong" size="large" height="hero" className="rounded-[36px]" />}>
        <DashboardHeroCard
          animeStats={animeStats} animeCompletionRate={animeCompletionRate} weeklyEpisodes={weeklyEpisodes}
          watchHours={Math.round(animeStats.minutesWatched / 60)}
          heroAnime={heroAnime}
          isLoading={isLoading} isRefreshing={isRefreshing}
        />
      </LazyRender>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 relative z-10">
        {/* Left (main) column */}
        <div className="lg:col-span-8 flex flex-col gap-4 lg:gap-5">
          <LazyRender fallback={<PanelSkeleton size="large" height="xlarge" />}>
            <Panel size="large" className="min-h-[420px] bg-gradient-to-br from-[var(--bg-card)]/40 via-transparent to-transparent">
              <AdvancedActivityStats history={parsedHistory} animeList={animeList} />
            </Panel>
          </LazyRender>

          <LazyRender fallback={<PanelSkeleton size="large" height="large" className="h-[300px]" />}>
            <Panel
              title="作品开播时间分布"
              description="基于每部作品的开播日期字段统计"
              size="large"
              className="flex flex-col"
              headerClassName="mb-2"
              contentClassName="flex flex-1 flex-col"
            >
              {premierePieData.length > 0 ? (
                <div className="flex-1 w-full min-h-[220px] mt-2 pb-2">
                  <YearBarChart data={premierePieData} height={220} />
                </div>
              ) : (
                <div className="flex-1 flex items-center"><div className="text-sm text-[var(--text-muted)]">开播日期字段还不够多，先在详情页补全几部作品即可生成分布。</div></div>
              )}
            </Panel>
          </LazyRender>

          {/* Recent Watching */}
          <Panel
            title="最近在看作品"
            action={<Link href="/anime/timeline" className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-widest">查看时间线</Link>}
            size="large"
            className="flex flex-col"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4 auto-rows-max content-start pr-1">
              {recentWatching.map(({ record, anime }) => (
                <Link key={`recent-${record.id}`} href={`/anime/${record.animeId}`}
                  className="group surface-card-muted rounded-[22px] overflow-hidden hover:border-[var(--accent)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01]">
                  <div className="aspect-video w-full bg-[var(--tag-bg)]/70 bg-cover bg-center"
                    style={anime?.displayCoverUrl ? { backgroundImage: `linear-gradient(180deg, var(--color-cover-gradient-start), var(--color-cover-gradient-end)), url(${anime.displayCoverUrl})` } : undefined} />
                  <div className="p-4">
                    <div className="mt-1 text-base text-[var(--text-primary)] truncate">{anime?.title ?? record.animeTitle}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{anime?.originalTitle ?? '来自观看历史'}</div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full theme-accent-soft px-2.5 py-1 text-[11px]">第 {record.episode} 集</span>
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
          </Panel>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-4 lg:gap-5">
          <LazyRender fallback={<PanelSkeleton size="large" height="medium" />}>
            <DashboardRightPanel
              metadataCoverage={dashboardStats.metadataCoverage} metadataRichness={dashboardStats.metadataRichness}
              tagBarData={tagBarData} tagBarMax={tagBarMax}
              recentPremiered={dashboardStats.recentPremiered}
            />
          </LazyRender>

          {/* Activity Feed */}
          <Panel
            title="最近记录"
            action={<Link href="/anime/timeline" className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">查看全部</Link>}
            size="large"
            overflow="hidden"
            className="flex flex-col"
          >
            <div className="max-h-[480px] lg:max-h-[430px] xl:max-h-[380px] overflow-y-auto pr-2 overscroll-contain">
              <ActivityFeed history={parsedHistory} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
