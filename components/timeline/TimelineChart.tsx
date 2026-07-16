"use client";

import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { ParsedWatchHistory } from '@/lib/dashboard-types';
import SegmentedControl from '@/components/shared/SegmentedControl';
import StatTile from '@/components/shared/StatTile';

/** Inline SVG line chart — adapted from AdvancedActivityStats */
function ActivityLineChart({ data, maxValue, scale }: { data: { label: string; value: number }[]; maxValue: number; scale: 'week' | 'month' | 'year' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSvgWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setSvgWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const H = 240;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 16;
  const padBottom = scale === 'month' ? 28 : 20;
  const chartW = Math.max(svgWidth - padLeft - padRight, 200);
  const chartH = H - padTop - padBottom;
  const yMax = maxValue < 4 ? 4 : maxValue;

  if (data.length === 0) {
    return <div className="flex h-[240px] items-center justify-center text-sm text-[var(--text-muted)]">暂无数据</div>;
  }

  const points = data.map((d, i) => {
    const x = padLeft + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padTop + chartH - (d.value / yMax) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;
  const yTicks = 4;
  const xLabelInterval = scale === 'month' ? 5 : scale === 'year' ? 1 : 1;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg width="100%" height={H} className="select-none block">
        <defs>
          <linearGradient id="tlLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-area-top)" />
            <stop offset="55%" stopColor="var(--chart-area-mid)" />
            <stop offset="100%" stopColor="var(--chart-area-bottom)" />
          </linearGradient>
          <linearGradient id="tlStrokeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--chart-line-start)" />
            <stop offset="100%" stopColor="var(--chart-line-end)" />
          </linearGradient>
          <filter id="tlGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: yTicks }, (_, i) => {
          const y = padTop + (chartH / (yTicks - 1)) * i;
          const val = Math.round(yMax - (yMax / (yTicks - 1)) * i);
          return (
            <g key={i}>
              <line x1={padLeft} x2={svgWidth - padRight} y1={y} y2={y} stroke="var(--chart-grid)" strokeDasharray="4,4" />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="var(--chart-axis-y)" fontSize={10}>{val}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#tlLineGrad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="url(#tlStrokeGrad)" strokeWidth={2.5} filter="url(#tlGlow)" />

        {/* Dots + Tooltips */}
        {points.map((p, i) => (
          <g key={i} className="group">
            <circle cx={p.x} cy={p.y} r={5} fill="var(--chart-dot)" stroke="var(--chart-dot-stroke)" strokeWidth={2} />
            <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
              <rect x={p.x - 36} y={p.y - 40} width={72} height={36} rx={10}
                fill="var(--chart-tooltip-bg)" stroke="var(--chart-tooltip-border)" strokeWidth={1} />
              <text x={p.x} y={p.y - 22} textAnchor="middle" fill="var(--chart-tooltip-text)" fontSize={16} fontWeight={600}>{p.value} EP</text>
              <text x={p.x} y={p.y - 10} textAnchor="middle" fill="var(--chart-tooltip-sub)" fontSize={10}>{p.label}</text>
            </g>
          </g>
        ))}

        {/* X-axis labels */}
        {points.filter((_, i) => i % xLabelInterval === 0).map((p) => (
          <text key={p.label} x={p.x} y={H - 4} textAnchor="middle" fill="var(--chart-axis-x)" fontSize={10}>{p.label}</text>
        ))}
      </svg>
    </div>
  );
}

interface TimelineChartProps {
  history: ParsedWatchHistory[];
}

export default memo(function TimelineChart({ history }: TimelineChartProps) {
  const [scale, setScale] = useState<'week' | 'month' | 'year'>('week');

  const { chartData, peakDay, activeDays, coveragePercent } = useMemo(() => {
    const now = new Date();
    const data: { label: string; value: number }[] = [];
    let total = 0;

    if (scale === 'week') {
      const historyMap: Record<string, number> = {};
      history.forEach(h => { historyMap[h.dateStr] = (historyMap[h.dateStr] || 0) + 1; });
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = historyMap[dateStr] || 0;
        total += count;
        data.push({ label: d.toLocaleDateString('zh-CN', { weekday: 'short' }), value: count });
      }
    } else if (scale === 'month') {
      const historyMap: Record<string, number> = {};
      history.forEach(h => { historyMap[h.dateStr] = (historyMap[h.dateStr] || 0) + 1; });
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const count = historyMap[dateStr] || 0;
        total += count;
        data.push({ label: `${i}`, value: count });
      }
    } else {
      const monthlyMap: Record<string, number> = {};
      const year = now.getFullYear();
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
    <div className="glass-panel rounded-[28px] p-5 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, var(--chart-line-start), var(--chart-line-end))' }} />
            观看趋势
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {scale === 'week' ? '过去 7 天' : scale === 'month' ? '本月每日' : '今年每月'} · 合计 {chartData.reduce((s, d) => s + d.value, 0)} 集
          </p>
        </div>
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
      </div>

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
        <ActivityLineChart data={chartData} maxValue={maxValue} scale={scale} />
      </div>
    </div>
  );
});
