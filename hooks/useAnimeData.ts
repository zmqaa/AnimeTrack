"use client";

import { useMemo } from 'react';
import useSWR from 'swr';
import { AnimeRecord, AnimeStatus, ParsedWatchHistory } from '@/lib/dashboard-types';
import { ANIME_LIST_KEY, swrFetcher } from '@/lib/swr-config';

export function useAnimeData(parsedHistory: ParsedWatchHistory[] = []) {
  const { data: animeList = [], isLoading, isValidating } = useSWR<AnimeRecord[]>(
    ANIME_LIST_KEY,
    swrFetcher
  );

  // 合并 animeStats + animeTagStats 为单次遍历
  const { animeStats, animeTagStats } = useMemo(() => {
    let episodes = 0;
    let minutes = 0;
    const byStatus: Record<AnimeStatus, number> = {
      watching: 0,
      completed: 0,
      dropped: 0,
      plan_to_watch: 0,
    };
    const tagCounts: Record<string, number> = {};

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const recentEpisodes = parsedHistory.filter(h => h.dateObj >= oneWeekAgo).length;

    for (const anime of animeList) {
      episodes += anime.progress;
      minutes += anime.progress * (anime.durationMinutes || 24);
      byStatus[anime.status] += 1;

      if (anime.tags && Array.isArray(anime.tags)) {
        for (const tag of anime.tags) {
          const t = tag.trim();
          if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
      }
    }

    return {
      animeStats: {
        count: animeList.length,
        episodesWatched: episodes,
        minutesWatched: minutes,
        byStatus,
        weeklyVelocity: recentEpisodes,
      },
      animeTagStats: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count })),
    };
  }, [animeList, parsedHistory]);

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
    isRefreshing: isValidating,
  };
}
