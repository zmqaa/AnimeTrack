"use client";

import { memo, useMemo, useState } from 'react';
import { ParsedWatchHistory } from '@/lib/dashboard-types';
import SegmentedControl from '@/components/shared/SegmentedControl';
import StatTile from '@/components/shared/StatTile';
import ActivityLineChart from '@/components/shared/ActivityLineChart';
import Panel from '@/components/shared/Panel';
import { APP_TIME_ZONE, dateKeyToAppDate, formatAppDateKey, getAppDateTimeParts, shiftDateKey } from '@/lib/date-utils';

interface TimelineChartProps {
  history: ParsedWatchHistory[];
}

export default memo(function TimelineChart({ history }: TimelineChartProps) {
  const [scale, setScale] = useState<'week' | 'month' | 'year'>('week');

  const { chartData, peakDay, activeDays, coveragePercent } = useMemo(() => {
    const now = new Date();
    const todayKey = formatAppDateKey(now);
    const nowParts = getAppDateTimeParts(now);
    const data: { label: string; value: number }[] = [];
    let total = 0;

    if (scale === 'week') {
      const historyMap: Record<string, number> = {};
      history.forEach(h => { historyMap[h.dateStr] = (historyMap[h.dateStr] || 0) + 1; });
      for (let i = 6; i >= 0; i--) {
        const dateStr = shiftDateKey(todayKey, -i);
        const d = dateKeyToAppDate(dateStr);
        const count = historyMap[dateStr] || 0;
        total += count;
        data.push({ label: d.toLocaleDateString('zh-CN', { weekday: 'short', timeZone: APP_TIME_ZONE }), value: count });
      }
    } else if (scale === 'month') {
      const historyMap: Record<string, number> = {};
      history.forEach(h => { historyMap[h.dateStr] = (historyMap[h.dateStr] || 0) + 1; });
      const year = nowParts.year;
      const month = nowParts.month - 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const count = historyMap[dateStr] || 0;
        total += count;
        data.push({ label: `${i}`, value: count });
      }
    } else {
      const monthlyMap: Record<string, number> = {};
      const year = nowParts.year;
      history.forEach(h => {
        if (h.year === year) {
          const monthKey = `${h.year}-${String(h.month + 1).padStart(2, '0')}`;
          monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
        }
      });
      for (let i = 0; i < 12; i++) {
        const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
        const count = monthlyMap[monthKey] || 0;
        total += count;
        data.push({ label: `${i + 1}月`, value: count });
      }
    }

    const peak = data.reduce((best, d) => d.value > best.value ? d : best, { label: '暂无', value: 0 });
    const active = data.filter(d => d.value > 0).length;
    // Coverage: percentage of data points with activity
    const coverage = data.length > 0 ? Math.round((active / data.length) * 100) : 0;

    return { chartData: data, totalEpisodes: total, peakDay: peak, activeDays: active, coveragePercent: coverage };
  }, [history, scale]);

  const maxValue = Math.max(...chartData.map(d => d.value), 1);

  return (
    <Panel
      title="观看趋势"
      description={`${scale === 'week' ? '过去 7 天' : scale === 'month' ? '本月每日' : '今年每月'} · 合计 ${chartData.reduce((sum, item) => sum + item.value, 0)} 集`}
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
          { label: '峰值日', value: peakDay.label, unit: `${peakDay.value} EP` },
          { label: '活跃度', value: activeDays, unit: scale === 'year' ? '月' : '天' },
          { label: '覆盖率', value: `${coveragePercent}%`, unit: scale === 'week' ? '周' : scale === 'month' ? '月' : '年' },
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
