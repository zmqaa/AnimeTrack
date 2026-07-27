import { memo } from 'react';
import type { TimelineStatsData } from '@/lib/timeline-types';
import StatTile from '@/components/shared/StatTile';
import PageHero from '@/components/shared/PageHero';

interface TimelineStatsProps {
  stats: TimelineStatsData;
}

export default memo(function TimelineStats({ stats }: TimelineStatsProps) {
  const cards = [
    { label: '已记录观看', value: stats.totalEpisodes, unit: 'EP' },
    { label: '涉及记录', value: stats.uniqueAnime, unit: '条' },
    { label: '记录活跃天数', value: stats.activeDays, unit: '天' },
    { label: '记录期日均', value: stats.avgEpisodesPerDay, unit: 'EP' },
    { label: '高频记录时段', value: stats.peakPeriod, unit: `× ${stats.peakPeriodCount}` },
  ];

  return (
    <PageHero
      className="glass-panel-strong"
      title="观看时间轴"
      description="回顾具有具体时间的观看记录；仅补录进度的早期作品不计入本页统计。"
      backHref="/anime"
      backLabel="返回番剧列表"
      align="start"
      layout="stacked"
      statsClassName="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      stats={(
        <>
          {cards.map((card) => (
            <StatTile
              key={card.label}
              label={card.label}
              value={card.value}
              unit={card.unit}
              surface="card"
              className="transition-colors hover:border-[var(--accent)]"
            />
          ))}
        </>
      )}
    />
  );
});
