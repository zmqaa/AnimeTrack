"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import type { EnrichedEntry } from '@/components/timeline/TimelineEnhancedList';
import type { TimelineViewMode } from '@/components/timeline/TimelineControls';
import type {
  TimelineEntriesResponse,
  TimelineOverview,
  TimelineSortBy,
} from '@/lib/timeline-types';
import { getAppDateTimeParts, formatAppDateKey } from '@/lib/date-utils';
import {
  TIMELINE_OVERVIEW_KEY,
  swrFetcher,
  timelineEntriesKey,
} from '@/lib/swr-config';
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
  const [viewMode, setViewMode] = useState<TimelineViewMode>('timeline');
  const [sortBy, setSortBy] = useState<TimelineSortBy>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const entriesKey = timelineEntriesKey({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    date: selectedDate || '',
    sortBy,
  });
  const { data: overview, isLoading: overviewLoading } = useSWR<TimelineOverview>(
    TIMELINE_OVERVIEW_KEY,
    swrFetcher,
  );
  const { data: entriesData } = useSWR<TimelineEntriesResponse>(
    entriesKey,
    swrFetcher,
    { keepPreviousData: true },
  );

  const prevFilters = useRef({ searchQuery, sortBy, selectedDate, groupBy, viewMode });
  useEffect(() => {
    const prev = prevFilters.current;
    if (prev.searchQuery !== searchQuery || prev.sortBy !== sortBy
        || prev.selectedDate !== selectedDate || prev.groupBy !== groupBy || prev.viewMode !== viewMode) {
      setPage(1);
    }
    prevFilters.current = { searchQuery, sortBy, selectedDate, groupBy, viewMode };
  }, [searchQuery, sortBy, selectedDate, groupBy, viewMode]);

  const entries = useMemo<EnrichedEntry[]>(() => {
    return (entriesData?.records || []).map(({ history, anime }) => {
      const dateObj = new Date(history.watchedAt);
      const parts = getAppDateTimeParts(dateObj);
      return {
        history: {
          ...history,
          dateObj,
          dateStr: formatAppDateKey(dateObj),
          hour: parts.hour,
          month: parts.month - 1,
          year: parts.year,
        },
        anime,
      };
    });
  }, [entriesData]);

  const handleViewModeChange = useCallback((mode: TimelineViewMode) => setViewMode(mode), []);
  const handleSortByChange = useCallback((sort: TimelineSortBy) => setSortBy(sort), []);
  const handleSearchChange = useCallback((query: string) => setSearchQuery(query), []);
  const handleDateChange = useCallback((date: string | null) => {
    setSelectedDate(date);
    setPage(1);
  }, []);
  const handleGroupByChange = useCallback((group: 'day' | 'week' | 'month') => setGroupBy(group), []);
  const handlePageChange = useCallback((nextPage: number) => setPage(nextPage), []);

  if (overviewLoading || !overview || !entriesData) {
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

  const summaries = debouncedSearch || selectedDate ? entriesData.summary || [] : overview.animeSummary;

  return (
    <PageContainer as="main" width="wide" spacing="compact">
      <LazyRender fallback={<PanelSkeleton surface="strong" size="large" height="medium" className="rounded-[36px]" />}>
        <TimelineStats stats={overview.stats} />
      </LazyRender>

      <LazyRender fallback={<PanelSkeleton height="large" />}>
        <TimelineChart activityByScale={overview.activityByScale} />
      </LazyRender>

      <LazyRender fallback={<PanelSkeleton height="small" />}>
        <TimelineHeatmap
          dailyCounts={overview.heatmap.dailyCounts}
          months={overview.heatmap.months}
          selectedDate={selectedDate}
          onDateSelect={handleDateChange}
        />
      </LazyRender>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5 items-start">
        <div className="space-y-5">
          <TimelineControls
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            sortBy={sortBy}
            onSortByChange={handleSortByChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
          />

          {viewMode === 'timeline' ? (
            <LazyRender fallback={<PanelSkeleton height="xlarge" />}>
              <TimelineEnhancedList
                entries={entries}
                groupBy={groupBy}
                hasFilter={Boolean(debouncedSearch || selectedDate)}
                page={entriesData.page}
                totalPages={entriesData.totalPages}
                totalItems={entriesData.total}
                onPageChange={handlePageChange}
              />
            </LazyRender>
          ) : (
            <LazyRender fallback={<PanelSkeleton height="xlarge" />}>
              <TimelineTable
                entries={entries}
                hasFilter={Boolean(debouncedSearch || selectedDate)}
                sortBy={sortBy}
                onSortByChange={handleSortByChange}
                page={entriesData.page}
                totalPages={entriesData.totalPages}
                totalItems={entriesData.total}
                onPageChange={handlePageChange}
              />
            </LazyRender>
          )}
        </div>

        <div>
          <LazyRender fallback={<PanelSkeleton height="medium" />}>
            <TimelineAnimeSummary
              summaries={summaries}
              searchQuery={debouncedSearch}
              selectedDate={selectedDate}
            />
          </LazyRender>
        </div>
      </div>

      <footer className="text-center pt-8 pb-4">
        <p className="text-[10px] text-[var(--text-muted)] font-mono tracking-tighter italic opacity-60">
          &ldquo;Every episode is a page in your story.&rdquo;
        </p>
      </footer>
    </PageContainer>
  );
}
