"use client";

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { useAnimeData } from '@/hooks/useAnimeData';
import { AnimeRecord, statusLabels } from '@/lib/dashboard-types';
import StatTile from '@/components/shared/StatTile';
import PageHero from '@/components/shared/PageHero';
import PageContainer from '@/components/shared/PageContainer';
import EmptyState from '@/components/shared/EmptyState';
import { PanelSkeleton } from '@/components/shared/Skeleton';
import AnimePagination from '../AnimePagination';
import {
  type SeasonName,
  startOfDay,
  seasonFromMonth,
  hasStartedWatching,
  getSeasonPremiere,
  compareDateDesc,
  compareSeasonAnime,
  formatSeasonLastWatchLabel,
  formatAnimeWatchState,
} from './seasons-helpers';

type SortDirection = 'desc' | 'asc';
const SEASONS_PER_PAGE = 6;

interface SeasonBucket {
  key: string;
  year: number;
  season: SeasonName;
  seasonOrder: number;
  count: number;
  started: number;
  completed: number;
  watching: number;
  totalProgress: number;
  lastWatchedAt?: string;
  items: AnimeRecord[];
}

interface VisibleSeasonBucket {
  bucket: SeasonBucket;
  visibleItems: AnimeRecord[];
}

function parseYearParam(value: string | null): number | 'all' {
  if (!value || value === 'all') return 'all';
  const year = Number(value);
  return Number.isInteger(year) && year > 0 ? year : 'all';
}

function AnimeSeasonsPageContent() {
  const { animeList, isLoading: animeLoading } = useAnimeData();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [showStartedOnly, setShowStartedOnly] = useState(() => searchParams.get('started') === '1');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(() => parseYearParam(searchParams.get('year')));
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => searchParams.get('order') === 'asc' ? 'asc' : 'desc');
  const [currentPage, setCurrentPage] = useState(() => {
    const page = Number(searchParams.get('page'));
    return Number.isInteger(page) && page > 0 ? page : 1;
  });
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
  const [expandedBuckets, setExpandedBuckets] = useState<Record<string, boolean>>({});
  const yearMenuRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);

  const seasonAnimeEntries = useMemo(
    () => animeList.flatMap((anime) => {
      const premiere = getSeasonPremiere(anime, today);
      return premiere ? [{ anime, premiere }] : [];
    }),
    [animeList, today]
  );

  const seasonBuckets = useMemo<SeasonBucket[]>(() => {
    const map = new Map<string, {
      year: number;
      season: SeasonName;
      seasonOrder: number;
      count: number;
      started: number;
      completed: number;
      watching: number;
      totalProgress: number;
      lastWatchedAt?: string;
      items: AnimeRecord[];
    }>();

    seasonAnimeEntries.forEach(({ anime, premiere }) => {
      const year = premiere.getFullYear();
      const { season, seasonOrder } = seasonFromMonth(premiere.getMonth());
      const key = `${year}-${seasonOrder}`;
      const bucket = map.get(key) ?? {
        year,
        season,
        seasonOrder,
        count: 0,
        started: 0,
        completed: 0,
        watching: 0,
        totalProgress: 0,
        lastWatchedAt: undefined,
        items: [],
      };

      const started = hasStartedWatching(anime);
      bucket.count += 1;
      if (started) {
        bucket.started += 1;
      }
      if (anime.status === 'completed') {
        bucket.completed += 1;
      }
      if (anime.status === 'watching') {
        bucket.watching += 1;
      }
      bucket.totalProgress += anime.progress || 0;
      if (compareDateDesc(anime.lastWatchedAt, bucket.lastWatchedAt) < 0) {
        bucket.lastWatchedAt = anime.lastWatchedAt;
      }
      bucket.items.push(anime);

      map.set(key, bucket);
    });

    return Array.from(map.entries())
      .map(([key, bucket]) => ({
        key,
        year: bucket.year,
        season: bucket.season,
        seasonOrder: bucket.seasonOrder,
        count: bucket.count,
        started: bucket.started,
        completed: bucket.completed,
        watching: bucket.watching,
        totalProgress: bucket.totalProgress,
        lastWatchedAt: bucket.lastWatchedAt,
        items: [...bucket.items].sort(compareSeasonAnime),
      }))
      .sort((left, right) => right.year - left.year || right.seasonOrder - left.seasonOrder);
  }, [seasonAnimeEntries]);

  const availableYears = useMemo(
    () => Array.from(new Set(seasonBuckets.map((bucket) => bucket.year))).sort((left, right) => right - left),
    [seasonBuckets]
  );

  const visibleSeasonBuckets = useMemo<VisibleSeasonBucket[]>(() => {
    const orderedBuckets = [...seasonBuckets]
      .filter((bucket) => selectedYear === 'all' || bucket.year === selectedYear)
      .sort((left, right) => {
        const compare = left.year - right.year || left.seasonOrder - right.seasonOrder;
        return sortDirection === 'asc' ? compare : -compare;
      });

    return orderedBuckets.flatMap((bucket) => {
      const visibleItems = showStartedOnly
        ? bucket.items.filter(hasStartedWatching)
        : bucket.items;

      if (!visibleItems.length) {
        return [];
      }

      return [{ bucket, visibleItems }];
    });
  }, [seasonBuckets, selectedYear, showStartedOnly, sortDirection]);

  const scopedAnime = useMemo(
    () => visibleSeasonBuckets.flatMap(({ visibleItems }) => visibleItems),
    [visibleSeasonBuckets]
  );
  const withPremiereCount = scopedAnime.length;
  const startedCount = useMemo(() => scopedAnime.filter(hasStartedWatching).length, [scopedAnime]);
  const completedCount = useMemo(() => scopedAnime.filter((anime) => anime.status === 'completed').length, [scopedAnime]);
  const totalProgressEpisodes = useMemo(
    () => scopedAnime.reduce((sum, anime) => sum + (anime.progress || 0), 0),
    [scopedAnime]
  );
  const visibleAnimeCount = useMemo(
    () => visibleSeasonBuckets.reduce((sum, entry) => sum + entry.visibleItems.length, 0),
    [visibleSeasonBuckets]
  );
  const yearScopeLabel = selectedYear === 'all' ? '全部年份' : `${selectedYear} 年`;
  const orderScopeLabel = sortDirection === 'desc' ? '从新到旧' : '从旧到新';
  const loading = animeLoading;
  const totalPages = selectedYear === 'all'
    ? Math.max(1, Math.ceil(visibleSeasonBuckets.length / SEASONS_PER_PAGE))
    : 1;
  const safePage = loading ? currentPage : Math.min(currentPage, totalPages);
  const paginatedSeasonBuckets = useMemo(
    () => selectedYear === 'all'
      ? visibleSeasonBuckets.slice((safePage - 1) * SEASONS_PER_PAGE, safePage * SEASONS_PER_PAGE)
      : visibleSeasonBuckets,
    [safePage, selectedYear, visibleSeasonBuckets]
  );
  const returnTo = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedYear !== 'all') params.set('year', String(selectedYear));
    if (sortDirection === 'asc') params.set('order', 'asc');
    if (showStartedOnly) params.set('started', '1');
    if (safePage > 1) params.set('page', String(safePage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, safePage, selectedYear, showStartedOnly, sortDirection]);

  useEffect(() => {
    if (!loading && currentPage !== safePage) setCurrentPage(safePage);
  }, [currentPage, loading, safePage]);

  useEffect(() => {
    router.replace(returnTo, { scroll: false });
  }, [returnTo, router]);

  const changePage = useCallback((page: number) => {
    setCurrentPage(page);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const changeYear = useCallback((year: number | 'all') => {
    setSelectedYear(year);
    setCurrentPage(1);
    setExpandedBuckets({});
    setIsYearMenuOpen(false);
  }, []);

  const changeSortDirection = useCallback((direction: SortDirection) => {
    setSortDirection(direction);
    setCurrentPage(1);
    setExpandedBuckets({});
  }, []);

  const changeStartedOnly = useCallback((startedOnly: boolean) => {
    setShowStartedOnly(startedOnly);
    setCurrentPage(1);
    setExpandedBuckets({});
  }, []);

  useEffect(() => {
    if (!isYearMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (yearMenuRef.current && !yearMenuRef.current.contains(event.target as Node)) {
        setIsYearMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsYearMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isYearMenuOpen]);

  return (
    <PageContainer as="main" width="wide" spacing="default">
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: 'radial-gradient(circle at top left, var(--secondary-light), transparent 32%), radial-gradient(circle at bottom right, var(--warm-light), transparent 30%)' }} />

      <PageHero
        className="glass-panel-strong"
        title="开播季度回顾"
        description="按作品真正已经开播的季度回看你的片库：这个季度你收了什么、开始追了什么、追到哪儿。这里只看 premiereDate 已填写且已经到过首播日的作品。"
        backHref="/"
        backLabel="返回总览"
        align="start"
        backdrop={<div className="absolute inset-0" style={{ background: 'radial-gradient(circle at top, var(--color-surface-raised), transparent 35%), linear-gradient(135deg, var(--secondary-light), transparent 42%, var(--warm-light))' }} />}
        statsClassName="grid min-w-full grid-cols-2 gap-3 lg:min-w-[360px] lg:max-w-[380px]"
        stats={(
          <>
            <StatTile surface="card" label="范围作品" value={loading ? '—' : withPremiereCount} detail="当前范围内的开播作品" />
            <StatTile surface="card" label="已经开追" value={loading ? '—' : startedCount} detail="当前范围内已经开始追过" />
            <StatTile surface="card" label="已经看完" value={loading ? '—' : completedCount} detail="当前范围内已经看完" />
            <StatTile surface="card" label="累计进度" value={loading ? '—' : totalProgressEpisodes} unit="集" detail="当前范围内的累计进度" />
          </>
        )}
      />

      <section className="relative z-20 flex flex-col gap-4 rounded-[30px] border border-[var(--border)] bg-[var(--color-surface-raised)] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">Notebook Scope</div>
          <div className="text-sm text-[var(--text-secondary)] lg:text-base">
            {showStartedOnly ? '当前只显示已经开始追番的作品卡片。' : '当前显示全部已开播作品。'}
            {` 年份范围：${yearScopeLabel}；排序：${orderScopeLabel}。`}
          </div>
          <div className="text-xs text-[var(--text-muted)] lg:text-sm">
            {loading ? '正在整理档期数据…' : `覆盖 ${visibleSeasonBuckets.length} 个季度，共 ${visibleAnimeCount} 部作品。`}
          </div>
        </div>
        <div className="flex flex-row flex-wrap items-center gap-3">
          <div ref={yearMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isYearMenuOpen}
              onClick={() => setIsYearMenuOpen((current) => !current)}
              className="surface-input theme-focus-accent flex min-w-[132px] items-center justify-between gap-3 rounded-full px-4 py-2 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-light)] hover:text-[var(--text-primary)]"
            >
              <span>{yearScopeLabel}</span>
              <ChevronUpDownIcon className="h-4 w-4 text-[var(--text-secondary)]" />
            </button>

            {isYearMenuOpen && (
              <div
                role="listbox"
                aria-label="按年份筛选季度"
                className="surface-card shadow-theme-lg absolute right-0 top-[calc(100%+0.65rem)] z-30 flex max-h-80 min-w-[180px] flex-col overflow-hidden rounded-[22px] p-2 backdrop-blur-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    changeYear('all');
                  }}
                  className={selectedYear === 'all'
                    ? 'surface-pill theme-selected-pill flex items-center justify-between rounded-[16px] px-4 py-3 text-left text-sm'
                    : 'flex items-center justify-between rounded-[16px] px-4 py-3 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]'}
                >
                  <span>全部年份</span>
                  {selectedYear === 'all' && <CheckIcon className="h-4 w-4" />}
                </button>
                <div className="my-1 h-px bg-[var(--border)]" />
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        changeYear(year);
                      }}
                      className={selectedYear === year
                        ? 'surface-pill theme-selected-pill flex items-center justify-between rounded-[16px] px-4 py-3 text-left text-sm'
                        : 'flex items-center justify-between rounded-[16px] px-4 py-3 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]'}
                    >
                      <span>{year} 年</span>
                      {selectedYear === year && <CheckIcon className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => changeSortDirection('desc')}
            aria-pressed={sortDirection === 'desc'}
            className="surface-pill theme-filter-pill rounded-full px-4 py-2 text-sm"
          >
            最新在前
          </button>
          <button
            type="button"
            onClick={() => changeSortDirection('asc')}
            aria-pressed={sortDirection === 'asc'}
            className="surface-pill theme-filter-pill rounded-full px-4 py-2 text-sm"
          >
            最早在前
          </button>
          <button
            type="button"
            onClick={() => changeStartedOnly(false)}
            aria-pressed={!showStartedOnly}
            className="surface-pill theme-filter-pill rounded-full px-4 py-2 text-sm"
          >
            全部开播作品
          </button>
          <button
            type="button"
            onClick={() => changeStartedOnly(true)}
            aria-pressed={showStartedOnly}
            className="surface-pill theme-filter-pill rounded-full px-4 py-2 text-sm"
          >
            只看已开始追番
          </button>
        </div>
      </section>

      <section ref={resultsRef} className="relative z-10 scroll-mt-6 space-y-5">
        {!loading && totalPages > 1 && (
          <AnimePagination
            loading={false}
            itemsCount={visibleSeasonBuckets.length}
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={changePage}
          />
        )}

        {loading && Array.from({ length: 3 }).map((_, index) => (
          <PanelSkeleton key={index} size="large" height="large" className="rounded-[34px]" />
        ))}

        {!loading && paginatedSeasonBuckets.map(({ bucket, visibleItems }) => {
          const isExpanded = Boolean(expandedBuckets[bucket.key]);
          const canExpand = visibleItems.length > 6;
          const renderedItems = isExpanded ? visibleItems : visibleItems.slice(0, 6);

          return (
            <article key={bucket.key} className="glass-panel rounded-[34px] p-7 lg:p-8 xl:p-9">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.32em] text-[var(--text-muted)]">Season Block</div>
                  <h2 className="mt-2 text-[2rem] font-display leading-none text-[var(--text-primary)] lg:text-[2.35rem]">{bucket.year}年 {bucket.season}番</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="surface-pill rounded-full px-4 py-2 text-sm text-[var(--text-secondary)]">入库 {bucket.count} 部</span>
                  <span className="surface-pill rounded-full px-4 py-2 text-sm text-[var(--text-secondary)]">已开始追番 {bucket.started} 部</span>
                  <span className="surface-pill rounded-full px-4 py-2 text-sm text-[var(--text-secondary)]">已看完 {bucket.completed} 部</span>
                  <span className="surface-pill rounded-full px-4 py-2 text-sm text-[var(--text-secondary)]">追番中 {bucket.watching} 部</span>
                  {showStartedOnly && (
                    <span className="surface-pill rounded-full px-4 py-2 text-sm text-[var(--text-secondary)]">当前展示 {visibleItems.length} 部</span>
                  )}
                </div>
              </div>

              <div className="surface-card-muted mt-5 grid grid-cols-2 rounded-[22px] px-2 py-4 sm:grid-cols-3">
                <div className="px-3 sm:px-5">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">Progress</div>
                  <div className="mt-1 text-lg font-mono text-[var(--text-primary)]">{bucket.totalProgress} 集</div>
                </div>
                <div className="border-l border-[var(--border)] px-3 sm:px-5">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">Last Watch</div>
                  <div className="mt-1 text-lg font-mono text-[var(--text-primary)]">{formatSeasonLastWatchLabel(bucket)}</div>
                </div>
                <div className="col-span-2 mt-4 border-t border-[var(--border)] px-3 pt-4 sm:col-span-1 sm:mt-0 sm:border-l sm:border-t-0 sm:px-5 sm:pt-0">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">Season View</div>
                  <div className="mt-1 text-lg font-mono text-[var(--text-primary)]">{bucket.started}/{bucket.count} 已开始</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {renderedItems.map((anime) => (
                  <Link
                    key={anime.id}
                    href={`/anime/${anime.id}?returnTo=${encodeURIComponent(returnTo)}`}
                    className="group surface-card-muted rounded-[22px] px-5 py-4 hover:border-[var(--color-airing)]/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-base font-medium text-[var(--text-primary)] truncate lg:text-lg">{anime.title}</div>
                        <div className="mt-1 text-sm text-[var(--text-muted)] truncate">
                          {anime.originalTitle ?? '未补充原名'}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)] lg:text-[13px]">
                          <span>{anime.progress} / {anime.totalEpisodes || '?'} EP</span>
                          <span className="h-1 w-1 rounded-full bg-[var(--tag-bg)]" />
                          <span>{formatAnimeWatchState(anime)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <span className="surface-pill rounded-full px-3 py-1.5 text-xs text-[var(--text-secondary)] lg:text-sm">{statusLabels[anime.status]}</span>
                        {typeof anime.score === 'number' && <span className="text-xs text-[var(--text-muted)] lg:text-[13px]">评分 {anime.score.toFixed(1)}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {canExpand && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <div className="text-sm text-[var(--text-muted)]">
                    {isExpanded ? `当前已展开全部 ${visibleItems.length} 部作品。` : `还有 ${visibleItems.length - renderedItems.length} 部作品未展开。`}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedBuckets((current) => ({
                      ...current,
                      [bucket.key]: !current[bucket.key],
                    }))}
                    className="surface-pill rounded-full px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    {isExpanded ? '收起到前 6 部' : `展开全部 ${visibleItems.length} 部`}
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {!loading && !visibleSeasonBuckets.length && (
          <EmptyState
            title={seasonBuckets.length ? '当前筛选没有结果' : '暂无首播季度数据'}
            description={seasonBuckets.length
              ? '可以切换年份、排序方式或关闭“只看已开始追番”。'
              : '补充已经开播作品的 premiereDate 后，它们会按季度整理在这里。'}
            surface="panel"
            className="rounded-[34px]"
          />
        )}

        {!loading && totalPages > 1 && (
          <AnimePagination
            loading={false}
            itemsCount={visibleSeasonBuckets.length}
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={changePage}
          />
        )}
      </section>
    </PageContainer>
  );
}

export default function AnimeSeasonsPage() {
  return (
    <Suspense fallback={<PageContainer as="main" width="wide" spacing="compact" animation="none"><div className="text-[var(--text-muted)]">正在打开档期簿...</div></PageContainer>}>
      <AnimeSeasonsPageContent />
    </Suspense>
  );
}
