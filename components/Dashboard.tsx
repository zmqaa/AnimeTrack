'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import type { DashboardOverview } from '@/lib/dashboard-types';
import { formatWatchMoment } from '@/lib/formatters';
import { DASHBOARD_OVERVIEW_KEY, swrFetcher } from '@/lib/swr-config';
import DashboardHeroCard from './dashboard/DashboardHeroCard';
import DashboardRightPanel from './dashboard/DashboardRightPanel';
import LazyRender from './shared/LazyRender';
import Panel from './shared/Panel';
import { PanelSkeleton } from './shared/Skeleton';

const YearBarChart = dynamic(() => import('./dashboard/YearBarChart').then(mod => mod.YearBarChart), { ssr: false });
const ActivityFeed = dynamic(() => import('./dashboard/ActivityFeed'), { ssr: false });
const AdvancedActivityStats = dynamic(() => import('./dashboard/AdvancedActivityStats'), { ssr: false });

const EMPTY_ACTIVITY = {
  data: [],
  totalEpisodes: 0,
  totalMinutes: 0,
  title: '',
  peakPoint: { label: '暂无', value: 0 },
  activeDays: 0,
  mostActiveWindow: ['暂无', 0] as [string, number],
  libraryCoverage: 0,
};

const EMPTY_OVERVIEW: DashboardOverview = {
  animeStats: {
    count: 0,
    episodesWatched: 0,
    minutesWatched: 0,
    byStatus: { watching: 0, completed: 0, dropped: 0, plan_to_watch: 0 },
  },
  animeCompletionRate: 0,
  weeklyEpisodes: 0,
  watchHours: 0,
  heroAnime: null,
  activityByScale: {
    week: EMPTY_ACTIVITY,
    month: EMPTY_ACTIVITY,
    year: EMPTY_ACTIVITY,
  },
  premiereChart: [],
  metadataCoverage: [],
  metadataRichness: 0,
  tagBarData: [],
  tagBarMax: 1,
  recentPremiered: [],
  recentWatching: [],
  activityFeed: [],
};

export default function Dashboard() {
  const {
    data: overview = EMPTY_OVERVIEW,
    isLoading,
    isValidating: isRefreshing,
  } = useSWR<DashboardOverview>(DASHBOARD_OVERVIEW_KEY, swrFetcher);

  return (
    <div className="p-4 lg:p-8 space-y-4 lg:space-y-6 animate-fade-in pb-20 relative">
      <div className="theme-dashboard-aura absolute inset-0 pointer-events-none opacity-40" />
      {/* Hero */}
      <LazyRender fallback={<PanelSkeleton surface="strong" size="large" height="hero" className="rounded-[36px]" />}>
        <DashboardHeroCard
          animeStats={overview.animeStats}
          animeCompletionRate={overview.animeCompletionRate}
          weeklyEpisodes={overview.weeklyEpisodes}
          watchHours={overview.watchHours}
          heroAnime={overview.heroAnime}
          isLoading={isLoading} isRefreshing={isRefreshing}
        />
      </LazyRender>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 relative z-10">
        {/* Left (main) column */}
        <div className="lg:col-span-8 flex flex-col gap-4 lg:gap-5">
          <LazyRender fallback={<PanelSkeleton size="large" height="xlarge" />}>
            <Panel size="large" className="min-h-[420px] bg-gradient-to-br from-[var(--bg-card)]/40 via-transparent to-transparent">
              <AdvancedActivityStats activityByScale={overview.activityByScale} />
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
              {overview.premiereChart.length > 0 ? (
                <div className="flex-1 w-full min-h-[220px] mt-2 pb-2">
                  <YearBarChart data={overview.premiereChart} height={220} />
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
              {overview.recentWatching.map(({ record, anime }) => (
                <Link key={`recent-${record.id}`} href={`/anime/${record.animeId}`}
                  className="group surface-card-muted rounded-[22px] overflow-hidden hover:border-[var(--accent)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.01]">
                  <div className="aspect-video w-full bg-[var(--tag-bg)]/70 bg-cover bg-center"
                    style={(anime.thumbnailCoverUrl || anime.displayCoverUrl) ? { backgroundImage: `linear-gradient(180deg, var(--color-cover-gradient-start), var(--color-cover-gradient-end)), url(${anime.thumbnailCoverUrl || anime.displayCoverUrl})` } : undefined} />
                  <div className="p-4">
                    <div className="mt-1 text-base text-[var(--text-primary)] truncate">{anime.title ?? record.animeTitle}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{anime.originalTitle ?? '来自观看历史'}</div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full theme-accent-soft px-2.5 py-1 text-[11px]">第 {record.episode} 集</span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">{formatWatchMoment(new Date(record.watchedAt))}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {Array.from({ length: Math.max(0, 9 - overview.recentWatching.length) }).map((_, i) => (
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
              metadataCoverage={overview.metadataCoverage}
              metadataRichness={overview.metadataRichness}
              tagBarData={overview.tagBarData}
              tagBarMax={overview.tagBarMax}
              recentPremiered={overview.recentPremiered}
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
              <ActivityFeed history={overview.activityFeed} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
