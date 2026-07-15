"use client";

import { useMemo } from 'react';
import useSWR from 'swr';
import { WatchHistoryRecord, ParsedWatchHistory } from '@/lib/dashboard-types';
import { HISTORY_KEY, swrFetcher } from '@/lib/swr-config';

export function useHistoryData() {
  const { data: rawData, isLoading, isValidating } = useSWR<Record<string, unknown>>(
    HISTORY_KEY,
    swrFetcher
  );

  const watchHistory = useMemo<WatchHistoryRecord[]>(() => {
    const entries = rawData?.entries;
    return Array.isArray(entries) ? entries as WatchHistoryRecord[] : [];
  }, [rawData]);

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

  return { watchHistory, parsedHistory, isLoading, isRefreshing: isValidating };
}
