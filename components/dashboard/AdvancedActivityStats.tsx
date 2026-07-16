"use client";

import { memo, useMemo, useState } from 'react';
import { AnimeRecord, ParsedWatchHistory } from '@/lib/dashboard-types';
import SegmentedControl from '@/components/shared/SegmentedControl';
import StatTile from '@/components/shared/StatTile';
import ActivityLineChart from '@/components/shared/ActivityLineChart';
import SectionTitle from '@/components/shared/SectionTitle';

export default memo(function AdvancedActivityStats({ history, animeList }: { history: ParsedWatchHistory[]; animeList: AnimeRecord[] }) {
  const [scale, setScale] = useState<'week' | 'month' | 'year'>('week');

  const statsData = useMemo(() => {
    const now = new Date();
    const data: { label: string; value: number }[] = [];
    let totalEpisodes = 0;
    const historyMap: Record<string, number> = {};
    history.forEach((h) => { historyMap[h.dateStr] = (historyMap[h.dateStr] || 0) + 1; });

    let scaleStart = new Date(now);

    if (scale === 'week') {
      scaleStart.setHours(0, 0, 0, 0);
      scaleStart.setDate(scaleStart.getDate() - 6);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = historyMap[dateStr] || 0;
        totalEpisodes += count;
        data.push({ label: d.toLocaleDateString('zh-CN', { weekday: 'short' }), value: count });
      }
    } else if (scale === 'month') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      scaleStart = new Date(year, month, 1);
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const count = historyMap[dateStr] || 0;
        totalEpisodes += count;
        data.push({ label: `${i}`, value: count });
      }
    } else {
      const year = now.getFullYear();
      const monthlyMap: Record<string, number> = {};
      scaleStart = new Date(year, 0, 1);
      history.forEach((h) => {
        if (h.year === year) {
          const monthKey = `${h.year}-${String(h.month + 1).padStart(2, '0')}`;
          monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
        }
      });
      for (let i = 0; i < 12; i++) {
        const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
        const count = monthlyMap[monthKey] || 0;
        totalEpisodes += count;
        data.push({ label: `${i + 1}月`, value: count });
      }
    }

    const totalMinutes = totalEpisodes * 24;
    const scopedHistory = history.filter((item) => item.dateObj >= scaleStart);
    const activeWindows = { '凌晨': 0, '日间': 0, '黄昏': 0, '深夜': 0 };
    scopedHistory.forEach((item) => {
      if (item.hour < 6) activeWindows['凌晨'] += 1;
      else if (item.hour < 14) activeWindows['日间'] += 1;
      else if (item.hour < 20) activeWindows['黄昏'] += 1;
      else activeWindows['深夜'] += 1;
    });

    const mostActiveWindow = Object.entries(activeWindows).sort((a, b) => b[1] - a[1])[0] ?? ['暂无', 0];
    const peakPoint = data.reduce((peak, point) => point.value > peak.value ? point : peak, { label: '暂无', value: 0 });
    const activeDays = data.filter((point) => point.value > 0).length;
    const knownEpisodes = animeList.reduce((sum, anime) => sum + (anime.totalEpisodes ?? anime.progress), 0);
    const libraryCoverage = knownEpisodes > 0 ? Math.min(100, Math.round((totalEpisodes / knownEpisodes) * 100)) : 0;

    const title = scale === 'week' ? '过去 7 日趋势' : scale === 'month' ? '本月每日趋势' : '年度每月趋势';
    return { data, totalEpisodes, totalMinutes, title, peakPoint, activeDays, mostActiveWindow, libraryCoverage };
  }, [animeList, history, scale]);

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
