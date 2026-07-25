"use client";

import { useMemo } from 'react';
import useSWR from 'swr';
import { WatchHistoryRecord, ParsedWatchHistory } from '@/lib/dashboard-types';
import { DASHBOARD_HISTORY_KEY, TIMELINE_HISTORY_KEY, swrFetcher } from '@/lib/swr-config';
import { getAppDateTimeParts, formatAppDateKey } from '@/lib/date-utils';

export function useHistoryData(scope: 'recent' | 'all' = 'recent') {
  const key = scope === 'all' ? TIMELINE_HISTORY_KEY : DASHBOARD_HISTORY_KEY;
  const { data: rawData, isLoading, isValidating } = useSWR<Record<string, unknown>>(
    key,
    swrFetcher
  );

  const watchHistory = useMemo<WatchHistoryRecord[]>(() => {
    const entries = rawData?.entries;
    return Array.isArray(entries) ? entries as WatchHistoryRecord[] : [];
  }, [rawData]);

  const parsedHistory = useMemo<ParsedWatchHistory[]>(() => {
    return watchHistory.map(h => {
      const d = new Date(h.watchedAt);
      const parts = getAppDateTimeParts(d);
      return {
        ...h,
        dateObj: d,
        dateStr: formatAppDateKey(d),
        hour: parts.hour,
        month: parts.month - 1,
        year: parts.year,
      };
    });
  }, [watchHistory]);

  return { watchHistory, parsedHistory, isLoading, isRefreshing: isValidating };
}
