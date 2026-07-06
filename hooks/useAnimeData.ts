"use client";

import { useMemo } from 'react';
import { AnimeRecord, AnimeStatus, ParsedWatchHistory } from '@/lib/dashboard-types';
import { useCachedFetch } from './useCachedFetch';

export function useAnimeData(parsedHistory: ParsedWatchHistory[] = []) {
  const { data: animeList, isLoading, isRefreshing } = useCachedFetch<AnimeRecord[]>({
    cacheKey: 'dashboard-anime',
    url: '/api/anime',
    errorMessage: '加载番剧数据失败',
  });

  const animeStats = useMemo(() => {
    let episodes = 0;
    let minutes = 0;
    const byStatus: Record<AnimeStatus, number> = {
      watching: 0,
      completed: 0,
      dropped: 0,
      plan_to_watch: 0,
    };

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentEpisodes = parsedHistory.filter(h => h.dateObj >= oneWeekAgo).length;

    animeList.forEach((anime) => {
      episodes += anime.progress;
      minutes += anime.progress * (anime.durationMinutes || 24);
      byStatus[anime.status] += 1;
    });

    return {
      count: animeList.length,
      episodesWatched: episodes,
      minutesWatched: minutes,
      byStatus,
      weeklyVelocity: recentEpisodes
    };
  }, [animeList, parsedHistory]);

  const animeTagStats = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    animeList.forEach(anime => {
      if (anime.tags && Array.isArray(anime.tags)) {
        anime.tags.forEach(tag => {
          const t = tag.trim();
          if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    });
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [animeList]);

  const recentTagStats = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const animeByTitle = new Map<string, AnimeRecord>();
    animeList.forEach((a) => {
      animeByTitle.set(a.title.toLowerCase(), a);
    });

    const animeById = new Map(animeList.map((a) => [a.id, a]));

    const tagCounts: Record<string, number> = {};
    parsedHistory.forEach((entry) => {
      if (entry.dateObj < cutoff) return;
      const matched = animeById.get(entry.animeId) || animeByTitle.get(entry.animeTitle.toLowerCase());
      if (matched?.tags) {
        matched.tags.forEach((tag) => {
          const t = tag.trim();
          if (!t) return;
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    });

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  }, [animeList, parsedHistory]);

  const animeCompletionRate = useMemo(() => {
    const completed = animeStats.byStatus.completed;
    const dropped = animeStats.byStatus.dropped;
    const watching = animeStats.byStatus.watching;

    const totalRelevant = completed + dropped + watching;
    if (totalRelevant === 0) return 0;
    return Math.round((completed / totalRelevant) * 100);
  }, [animeStats]);

  return {
    animeList,
    animeStats,
    animeTagStats,
    recentTagStats,
    animeCompletionRate,
    isLoading,
    isRefreshing
  };
}
