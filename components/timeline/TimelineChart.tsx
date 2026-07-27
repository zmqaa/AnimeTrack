"use client";

import { memo, useState } from 'react';
import type { TimelineOverview } from '@/lib/timeline-types';
import SegmentedControl from '@/components/shared/SegmentedControl';
import StatTile from '@/components/shared/StatTile';
import ActivityLineChart from '@/components/shared/ActivityLineChart';
import Panel from '@/components/shared/Panel';

interface TimelineChartProps {
  activityByScale: TimelineOverview['activityByScale'];
}

export default memo(function TimelineChart({ activityByScale }: TimelineChartProps) {
  const [scale, setScale] = useState<'week' | 'month' | 'year'>('week');
  const activity = activityByScale[scale];
  const chartData = activity.data;

  const maxValue = Math.max(...chartData.map(d => d.value), 1);

  return (
    <Panel
      title="观看趋势"
      description={`${scale === 'week' ? '过去 7 天' : scale === 'month' ? '本月每日' : '今年每月'} · 合计 ${activity.totalEpisodes} 集`}
      action={(
        <SegmentedControl
          value={scale}
          options={[
            { value: 'week', label: '周' },
            { value: 'month', label: '月' },
            { value: 'year', label: '年' },
          ]}
          onChange={setScale}
          ariaLabel="观看趋势时间范围"
          className="self-start"
        />
      )}
    >

      {/* Callout cards */}
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { label: '峰值日', value: activity.peakPoint.label, unit: `${activity.peakPoint.value} EP` },
          { label: '活跃度', value: activity.activeDays, unit: scale === 'year' ? '月' : '天' },
          { label: '覆盖率', value: `${activity.coveragePercent}%`, unit: scale === 'week' ? '周' : scale === 'month' ? '月' : '年' },
        ].map((item) => (
          <StatTile key={item.label} label={item.label} value={item.value} unit={item.unit} layout="split" />
        ))}
      </div>

      {/* Chart */}
      <div className="surface-card-muted rounded-2xl p-3 md:p-4 bg-[linear-gradient(180deg,var(--tag-bg),transparent)]">
        <ActivityLineChart data={chartData} maxValue={maxValue} scale={scale} height={240} idPrefix="timeline-activity" />
      </div>
    </Panel>
  );
});
