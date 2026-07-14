"use client";

import { memo, useMemo } from 'react';
import { ParsedWatchHistory, AnimeRecord } from '@/lib/dashboard-types';
import { PlayIcon, TvIcon, CalendarDaysIcon, BoltIcon, ClockIcon } from '@heroicons/react/24/outline';

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
    { label: '总看番集数', value: stats.totalEpisodes, unit: 'EP', icon: PlayIcon, color: 'text-[var(--text-primary)]' },
    { label: '涉及番剧', value: stats.uniqueAnime, unit: '部', icon: TvIcon, color: 'text-[var(--color-watching)]' },
    { label: '活跃天数', value: stats.activeDays, unit: '天', icon: CalendarDaysIcon, color: 'text-[var(--color-completed)]' },
    { label: '日均看番', value: stats.avgEpPerDay, unit: 'EP', icon: BoltIcon, color: 'text-[var(--color-airing)]' },
    { label: '高频时段', value: stats.peakPeriod, unit: `×${stats.peakPeriodCount}`, icon: ClockIcon, color: 'score-text' },
  ];

  return (
    <div className="glass-panel rounded-[28px] p-5 md:p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="surface-card-muted rounded-2xl p-4 flex flex-col gap-2 hover:border-[var(--border)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <card.icon className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {card.label}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold font-mono tracking-tighter ${card.color}`}>
                {card.value}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
