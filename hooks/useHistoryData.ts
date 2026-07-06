"use client";

import { useMemo } from 'react';
import { WatchHistoryRecord, ParsedWatchHistory } from '@/lib/dashboard-types';
import { useCachedFetch } from './useCachedFetch';

export function useHistoryData() {
  const { data: watchHistory, isLoading, isRefreshing } = useCachedFetch<WatchHistoryRecord[]>({
    cacheKey: 'dashboard-history',
    url: '/api/history?days=370&limit=800',
    errorMessage: '加载观看历史失败',
    transform: (data) => {
      const entries = (data as Record<string, unknown>)?.entries;
      return Array.isArray(entries) ? entries as WatchHistoryRecord[] : [];
    },
  });

  const parsedHistory = useMemo<ParsedWatchHistory[]>(() => {
    return watchHistory.map(h => {
      const d = new Date(h.watchedAt);
      return {
        ...h,
        dateObj: d,
        dateStr: h.watchedAt.split('T')[0],
        hour: d.getHours(),
        month: d.getMonth(),
        year: d.getFullYear()
      };
    });
  }, [watchHistory]);

  return { watchHistory, parsedHistory, isLoading, isRefreshing };
}
