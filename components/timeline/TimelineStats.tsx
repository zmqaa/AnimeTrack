"use client";

import { memo, useMemo } from 'react';
import { ParsedWatchHistory, AnimeRecord } from '@/lib/dashboard-types';
import StatTile from '@/components/shared/StatTile';

interface TimelineStatsProps {
  history: ParsedWatchHistory[];
  animeMap: Map<number, AnimeRecord>;
}

export default memo(function TimelineStats({ history, animeMap }: TimelineStatsProps) {
  const stats = useMemo(() => {
    const totalEpisodes = history.length;
    const uniqueAnimeIds = new Set<number>();
    const activeDays = new Set<string>();
    const periodCounts: Record<string, number> = { '凌晨': 0, '日间': 0, '黄昏': 0, '深夜': 0 };

    for (const h of history) {
      uniqueAnimeIds.add(h.animeId);
      activeDays.add(h.dateStr);
      if (h.hour < 6) periodCounts['凌晨']++;
      else if (h.hour < 14) periodCounts['日间']++;
      else if (h.hour < 20) periodCounts['黄昏']++;
      else periodCounts['深夜']++;
    }

    const totalActiveDays = activeDays.size || 1;
    const avgEpPerDay = (totalEpisodes / totalActiveDays).toFixed(1);
    const peakPeriod = Object.entries(periodCounts).sort((a, b) => b[1] - a[1])[0];

    // Count anime with covers vs without
    let withCover = 0;
    uniqueAnimeIds.forEach(id => {
      const anime = animeMap.get(id);
      if (anime?.coverUrl) withCover++;
    });

    return {
      totalEpisodes,
      uniqueAnime: uniqueAnimeIds.size,
      activeDays: totalActiveDays,
      avgEpPerDay,
      peakPeriod: peakPeriod?.[0] ?? '暂无',
      peakPeriodCount: peakPeriod?.[1] ?? 0,
      withCover,
      totalUnique: uniqueAnimeIds.size,
    };
  }, [history, animeMap]);

  const cards = [
    { label: '总看番集数', value: stats.totalEpisodes, unit: 'EP' },
    { label: '涉及番剧', value: stats.uniqueAnime, unit: '部' },
    { label: '活跃天数', value: stats.activeDays, unit: '天' },
    { label: '日均看番', value: stats.avgEpPerDay, unit: 'EP' },
    { label: '高频时段', value: stats.peakPeriod, unit: `× ${stats.peakPeriodCount}` },
  ];

  return (
    <div className="glass-panel rounded-[28px] p-5 md:p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => (
          <StatTile
            key={card.label}
            label={card.label}
            value={card.value}
            unit={card.unit}
            className="transition-colors hover:border-[var(--accent)]"
          />
        ))}
      </div>
    </div>
  );
});
