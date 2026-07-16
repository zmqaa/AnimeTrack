"use client";

import { useMemo } from 'react';
import ChartTooltip from '@/components/shared/ChartTooltip';
import { getBoundedTooltipPosition } from '@/components/shared/chart-utils';
import { useActiveChartItem, useElementSize } from '@/components/shared/useResponsiveChart';

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
  const { ref: containerRef, width: containerWidth } = useElementSize<HTMLDivElement>();

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
  const {
    activeIndex,
    activeItem,
    activate: setActiveIndex,
    clear: clearActiveIndex,
  } = useActiveChartItem(chartData);

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
  const activeBarHeight = activeItem ? Math.max(2, (activeItem.value / maxVal) * chartAreaHeight) : 0;
  const activeBarCenterX = activeIndex === null ? 0 : leftPad + activeIndex * barSpacing + barSpacing / 2;
  const activeBarTop = baselineY - activeBarHeight;
  const tooltipWidth = 144;
  const tooltipHeight = 68;
  const tooltipPosition = getBoundedTooltipPosition({
    anchorX: activeBarCenterX,
    anchorY: activeBarTop,
    containerWidth,
    containerHeight: height,
    tooltipWidth,
    tooltipHeight,
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: `${height}px` }}
      onMouseLeave={clearActiveIndex}
    >
      <svg width="100%" height={height} className="select-none" role="img" aria-label="作品分布柱状图">
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

        {activeIndex !== null ? (
          <rect
            x={leftPad + activeIndex * barSpacing}
            y={topPad}
            width={barSpacing}
            height={chartAreaHeight}
            rx={8}
            fill="var(--chart-area-top)"
            opacity={0.32}
            className="pointer-events-none"
          />
        ) : null}

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
                className="transition-all duration-200"
                style={{ filter: activeIndex === i ? 'brightness(1.3)' : undefined }}
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
                x={leftPad + i * barSpacing}
                y={topPad}
                width={barSpacing}
                height={chartAreaHeight}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${labelText}，${d.value} 部`}
                onMouseEnter={() => setActiveIndex(i)}
                onFocus={() => setActiveIndex(i)}
                onBlur={clearActiveIndex}
                onPointerDown={() => setActiveIndex(i)}
                style={{ cursor: 'pointer', outline: 'none' }}
              />
            </g>
          );
        })}
      </svg>
      {activeItem ? (
        <ChartTooltip
          label={activeItem.label.replace(' 年', '')}
          value={activeItem.value}
          unit="部"
          emphasis
          className="left-0 top-0"
          style={{ left: tooltipPosition.left, right: 'auto', top: tooltipPosition.top, width: tooltipWidth }}
        />
      ) : null}
    </div>
  );
}
