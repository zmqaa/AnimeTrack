"use client";

import { memo, useState } from 'react';
import type { DashboardActivityScale, DashboardActivityStats } from '@/lib/dashboard-types';
import SegmentedControl from '@/components/shared/SegmentedControl';
import StatTile from '@/components/shared/StatTile';
import ActivityLineChart from '@/components/shared/ActivityLineChart';
import SectionTitle from '@/components/shared/SectionTitle';

export default memo(function AdvancedActivityStats({
  activityByScale,
}: {
  activityByScale: Record<DashboardActivityScale, DashboardActivityStats>;
}) {
  const [scale, setScale] = useState<DashboardActivityScale>('week');
  const statsData = activityByScale[scale];

  const maxValue = Math.max(...statsData.data.map((d) => d.value), 1);
  const averagePerUnit = scale === 'week' ? 7 : scale === 'month' ? 30 : 365;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <SectionTitle>观影趋势分析</SectionTitle>
          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-6">{statsData.title}，现在会额外给出高频观看时段和这一段时间对整库的推进占比。</p>
        </div>

        <SegmentedControl
          value={scale}
          options={[
            { value: 'week', label: '周' },
            { value: 'month', label: '月' },
            { value: 'year', label: '年' },
          ]}
          onChange={setScale}
          ariaLabel="观影趋势时间范围"
          className="self-start rounded-2xl p-1.5 shadow-xl lg:self-auto"
          activeClassName="text-[var(--accent)]"
        />
      </div>

      {/* Stat cards */}
      <div className="surface-card-muted grid grid-cols-1 gap-2 rounded-2xl p-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '总看番集数', value: statsData.totalEpisodes, unit: '集', detail: `峰值 ${statsData.peakPoint.label} · ${statsData.peakPoint.value} 集` },
          { label: '时长', value: Math.round(statsData.totalMinutes / 60), unit: '小时', detail: '按每集 24 分钟估算' },
          { label: '活跃效率', value: (statsData.totalEpisodes / averagePerUnit).toFixed(1), unit: '集/日', detail: `${statsData.activeDays} 个活跃日` },
          { label: '高频时段', value: statsData.mostActiveWindow[0], unit: `× ${statsData.mostActiveWindow[1]}`, detail: `整库推进 ${statsData.libraryCoverage}%` },
        ].map((item) => (
          <StatTile
            key={item.label}
            label={item.label}
            value={item.value}
            unit={item.unit}
            detail={item.detail}
            surface="inset"
            className="lg:px-5"
          />
        ))}
      </div>

      {/* Chart */}
      <div className="surface-card-muted h-[320px] rounded-[28px] bg-[linear-gradient(180deg,var(--tag-bg),transparent)] p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[10px] tracking-[0.28em] text-[var(--text-muted)]">观看趋势</div>
          <div className="status-plan-soft hidden rounded-full px-3 py-1 text-[10px] tracking-[0.2em] md:flex">
            {scale === 'week' ? '近 7 日' : scale === 'month' ? '本月' : '本年'}
          </div>
        </div>
        <ActivityLineChart data={statsData.data} maxValue={maxValue} scale={scale} idPrefix="dashboard-activity" />
      </div>
    </div>
  );
});
