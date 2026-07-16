"use client";

import { useMemo, useRef, useState, useEffect } from 'react';

interface ChartItem {
  label: string;
  value: number;
  color?: string;
}

interface YearBarChartProps {
  data: ChartItem[];
  height?: number;
  /** Sort strategy: 'label' = by label (year/alphabetical, default), 'value' = by value descending, 'none' = keep input order */
  sortBy?: 'label' | 'value' | 'none';
  /** Font size for x-axis labels (default: 9 when ≤15 items, 8 when >15) */
  labelFontSize?: number;
}

export function YearBarChart({ data, height = 220, sortBy = 'label', labelFontSize }: YearBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(() => {
    if (sortBy === 'none') return data;
    if (sortBy === 'value') return [...data].sort((a, b) => b.value - a.value);
    // default: sort by label (year or alphabetical)
    return [...data].sort((a, b) => {
      const yearA = parseInt(a.label);
      const yearB = parseInt(b.label);
      if (!isNaN(yearA) && !isNaN(yearB)) return yearA - yearB;
      return a.label.localeCompare(b.label);
    });
  }, [data, sortBy]);

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const denseLabels = chartData.length > 15;
  const topPad = 12;
  // Rotated year labels extend below their anchor point, so reserve a real
  // x-axis gutter instead of anchoring them against the SVG's clipped edge.
  const bottomPad = denseLabels ? 44 : 30;
  const chartAreaHeight = Math.max(height - topPad - bottomPad, 40);
  const leftPad = 36;
  const rightPad = 20;
  const chartW = Math.max(containerWidth - leftPad - rightPad, 200);
  const barSpacing = chartW / Math.max(chartData.length, 1);
  const barWidth = Math.max(6, Math.min(40, barSpacing - 8));
  const baselineY = topPad + chartAreaHeight;
  const labelY = baselineY + (denseLabels ? 13 : 16);

  return (
    <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }}>
      <svg width="100%" height={height} className="select-none">
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = topPad + chartAreaHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={leftPad} x2={leftPad + chartW} y1={y} y2={y} stroke="var(--barchart-grid)" strokeDasharray="4,4" />
              <text x={leftPad - 4} y={y + 3} textAnchor="end" fill="var(--barchart-axis-y)" fontSize={9}>
                {Math.round(maxVal * ratio)}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={leftPad} x2={leftPad + chartW} y1={baselineY} y2={baselineY} stroke="var(--barchart-baseline)" />

        {/* Bars */}
        {chartData.map((d, i) => {
          const barH = Math.max(2, (d.value / maxVal) * chartAreaHeight);
          const barX = leftPad + i * barSpacing + (barSpacing - barWidth) / 2;
          const barY = baselineY - barH;
          const color = d.color || 'var(--barchart-bar-default)';
          const barId = `bar-grad-${i}`;
          const labelText = d.label.replace(' 年', '');

          return (
            <g key={d.label} className="group relative">
              <defs>
                <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <rect
                x={barX}
                y={barY}
                width={barWidth}
                height={barH}
                rx={3}
                fill={`url(#${barId})`}
                className="transition-all duration-200 hover:brightness-125"
              />
              {/* X-axis label */}
              <text
                x={barX + barWidth / 2}
                y={labelY}
                textAnchor={denseLabels ? 'end' : 'middle'}
                fill="var(--barchart-axis-x)"
                fontSize={labelFontSize ?? (denseLabels ? 8 : 9)}
                transform={denseLabels ? `rotate(-45 ${barX + barWidth / 2} ${labelY})` : undefined}
              >
                {labelText}
              </text>
              {/* Hover area (wider than the bar for easier targeting) */}
              <rect
                x={barX - 4}
                y={0}
                width={barWidth + 8}
                height={baselineY}
                fill="transparent"
                className="peer"
              />
              {/* Tooltip on hover */}
              <foreignObject
                x={Math.max(0, barX + barWidth / 2 - 60)}
                y={Math.max(0, barY - 60)}
                width={120}
                height={56}
                className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100"
                style={{ overflow: 'visible' }}
              >
                <div className="shadow-theme-lg rounded-xl px-3 py-2.5 text-center"
                  style={{ backgroundColor: 'var(--barchart-tooltip-bg)', border: '1px solid var(--barchart-tooltip-border)' }}>
                  <div className="text-[10px] uppercase" style={{ color: 'var(--barchart-tooltip-sub)' }}>{labelText}</div>
                  <div className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--barchart-tooltip-text)' }}>{d.value} 部</div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
