"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
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
import { PanelSkeleton } from '@/components/shared/Skeleton';
import PageContainer from '@/components/shared/PageContainer';

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
      <PageContainer as="main" width="wide" spacing="roomy" animation="none">
        <PanelSkeleton surface="strong" size="large" height="medium" className="rounded-[36px]" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-5">
          <PanelSkeleton height="large" />
          <PanelSkeleton height="large" />
        </div>
        <PanelSkeleton height="medium" />
      </PageContainer>
    );
  }

  return (
    <PageContainer as="main" width="wide" spacing="compact">
      {/* Page hero + stats */}
      <LazyRender fallback={<PanelSkeleton surface="strong" size="large" height="medium" className="rounded-[36px]" />}>
        <TimelineStats history={parsedHistory} animeMap={animeMap} />
      </LazyRender>

      {/* Chart — full width */}
      <LazyRender fallback={<PanelSkeleton height="large" />}>
        <TimelineChart history={parsedHistory} />
      </LazyRender>

      {/* Heatmap — full width, 12 months */}
      <LazyRender fallback={<PanelSkeleton height="small" />}>
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
            <LazyRender fallback={<PanelSkeleton height="xlarge" />}>
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
            <LazyRender fallback={<PanelSkeleton height="xlarge" />}>
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
          <LazyRender fallback={<PanelSkeleton height="medium" />}>
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
    </PageContainer>
  );
}
