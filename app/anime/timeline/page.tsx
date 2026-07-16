"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useAnimeData } from '@/hooks/useAnimeData';
import { useHistoryData } from '@/hooks/useHistoryData';
import { AnimeRecord } from '@/lib/dashboard-types';
import type { EnrichedEntry } from '@/components/timeline/TimelineEnhancedList';
import type { TimelineViewMode, TimelineSortBy } from '@/components/timeline/TimelineControls';
import LazyRender from '@/components/shared/LazyRender';
import TimelineStats from '@/components/timeline/TimelineStats';
import TimelineControls from '@/components/timeline/TimelineControls';
import TimelineAnimeSummary from '@/components/timeline/TimelineAnimeSummary';
import TimelineEnhancedList from '@/components/timeline/TimelineEnhancedList';
import TimelineHeatmap from '@/components/timeline/TimelineHeatmap';

const TimelineChart = dynamic(() => import('@/components/timeline/TimelineChart'), { ssr: false });
const TimelineTable = dynamic(() => import('@/components/timeline/TimelineTable'), { ssr: false });

const PAGE_SIZE = 10;

export default function AnimeTimelinePage() {
  const { parsedHistory, isLoading: hLoading } = useHistoryData();
  const { animeList, isLoading: aLoading } = useAnimeData(parsedHistory);

  const isLoading = aLoading || hLoading;

  // View state
  const [viewMode, setViewMode] = useState<TimelineViewMode>('timeline');
  const [sortBy, setSortBy] = useState<TimelineSortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [page, setPage] = useState(1);

  // Reset page when search/sort/groupBy changes
  const prevFilters = useRef({ searchQuery, sortBy, groupBy, viewMode });
  useEffect(() => {
    const prev = prevFilters.current;
    if (prev.searchQuery !== searchQuery || prev.sortBy !== sortBy ||
        prev.groupBy !== groupBy || prev.viewMode !== viewMode) {
      setPage(1);
    }
    prevFilters.current = { searchQuery, sortBy, groupBy, viewMode };
  }, [searchQuery, sortBy, groupBy, viewMode]);

  // Build anime by-id map
  const animeMap = useMemo(
    () => new Map<number, AnimeRecord>(animeList.map(a => [a.id, a])),
    [animeList]
  );

  // Create enriched entries: history + matched anime
  const enrichedEntries = useMemo<EnrichedEntry[]>(() => {
    return parsedHistory.map(h => ({
      history: h,
      anime: animeMap.get(h.animeId),
    }));
  }, [parsedHistory, animeMap]);

  // Sort enriched entries
  const sortedEntries = useMemo(() => {
    const arr = [...enrichedEntries];
    switch (sortBy) {
      case 'newest':
        arr.sort((a, b) => b.history.dateObj.getTime() - a.history.dateObj.getTime());
        break;
      case 'oldest':
        arr.sort((a, b) => a.history.dateObj.getTime() - b.history.dateObj.getTime());
        break;
      case 'mostEpisodes':
        arr.sort((a, b) => b.history.episode - a.history.episode);
        break;
    }
    return arr;
  }, [enrichedEntries, sortBy]);

  // Memoize callbacks
  const handleViewModeChange = useCallback((mode: TimelineViewMode) => setViewMode(mode), []);
  const handleSortByChange = useCallback((sort: TimelineSortBy) => setSortBy(sort), []);
  const handleSearchChange = useCallback((q: string) => setSearchQuery(q), []);
  const handleGroupByChange = useCallback((g: 'day' | 'week' | 'month') => setGroupBy(g), []);
  const handlePageChange = useCallback((p: number) => setPage(p), []);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-[1660px] space-y-8 px-4 md:px-6 xl:px-8 2xl:px-10 py-8">
        <div className="space-y-1">
          <div className="h-4 w-28 bg-[var(--tag-bg)] rounded animate-pulse mb-4" />
          <div className="h-8 w-48 bg-[var(--tag-bg)] rounded animate-pulse" />
        </div>
        <div className="glass-panel rounded-[28px] h-28 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-5">
          <div className="glass-panel rounded-[28px] h-80 animate-pulse" />
          <div className="glass-panel rounded-[28px] h-80 animate-pulse" />
        </div>
        <div className="glass-panel rounded-[28px] h-64 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1660px] space-y-6 px-4 md:px-6 xl:px-8 2xl:px-10 py-8 animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/anime"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 text-sm mb-4 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" /> 返回番剧管理
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">详细记录</h1>
          <p className="text-[var(--text-muted)] font-mono text-xs uppercase tracking-widest">
            Watch History &amp; Analytics
          </p>
        </div>
        <div className="hidden sm:block text-right">
          <span className="text-4xl font-black text-[var(--color-surface-raised)] italic select-none">TIMELINE</span>
        </div>
      </header>

      {/* Stats Bar */}
      <LazyRender fallback={<div className="glass-panel rounded-[28px] h-28 animate-pulse" />}>
        <TimelineStats history={parsedHistory} animeMap={animeMap} />
      </LazyRender>

      {/* Chart — full width */}
      <LazyRender fallback={<div className="glass-panel rounded-[28px] h-80 animate-pulse" />}>
        <TimelineChart history={parsedHistory} />
      </LazyRender>

      {/* Heatmap — full width, 12 months */}
      <LazyRender fallback={<div className="glass-panel rounded-[28px] h-52 animate-pulse" />}>
        <TimelineHeatmap history={parsedHistory} months={12} />
      </LazyRender>

      {/* Main Content — always left-right: controls + view on left, summary on right */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5 items-start">
        {/* Left: Controls + content */}
        <div className="space-y-5">
          <TimelineControls
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            sortBy={sortBy}
            onSortByChange={handleSortByChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
          />

          {viewMode === 'timeline' ? (
            <LazyRender fallback={<div className="glass-panel rounded-[28px] h-96 animate-pulse" />}>
              <TimelineEnhancedList
                entries={sortedEntries}
                groupBy={groupBy}
                searchQuery={searchQuery}
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={handlePageChange}
              />
            </LazyRender>
          ) : (
            <LazyRender fallback={<div className="glass-panel rounded-[28px] h-96 animate-pulse" />}>
              <TimelineTable
                entries={sortedEntries}
                searchQuery={searchQuery}
                sortBy={sortBy}
                onSortByChange={handleSortByChange}
              />
            </LazyRender>
          )}
        </div>

        {/* Right: Anime Summary */}
        <div>
          <LazyRender fallback={<div className="glass-panel rounded-[28px] h-64 animate-pulse" />}>
            <TimelineAnimeSummary
              entries={sortedEntries}
              searchQuery={searchQuery}
            />
          </LazyRender>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center pt-8 pb-4">
        <p className="text-[10px] text-[var(--text-muted)] font-mono tracking-tighter italic opacity-60">
          &ldquo;Every episode is a page in your story.&rdquo;
        </p>
      </footer>
    </main>
  );
}
