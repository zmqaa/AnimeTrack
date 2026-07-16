"use client";

import { useMemo } from 'react';
import ChartTooltip from '@/components/shared/ChartTooltip';
import { buildMonotoneCurvePath, getBoundedTooltipPosition } from '@/components/shared/chart-utils';
import { useActiveChartItem, useElementSize } from '@/components/shared/useResponsiveChart';

interface ActivityLineChartProps {
  data: { label: string; value: number }[];
  maxValue: number;
  scale: 'week' | 'month' | 'year';
  height?: number;
  idPrefix: string;
}

export default function ActivityLineChart({
  data,
  maxValue,
  scale,
  height = 250,
  idPrefix,
}: ActivityLineChartProps) {
  const { ref: containerRef, width: svgWidth } = useElementSize<HTMLDivElement>();

  const padLeft = 40;
  const padRight = 16;
  const padTop = 16;
  const padBottom = scale === 'month' ? 30 : 20;
  const chartW = Math.max(svgWidth - padLeft - padRight, 200);
  const chartH = height - padTop - padBottom;
  const yMax = maxValue < 4 ? 4 : maxValue;
  const yTicks = height >= 250 ? 3 : 4;
  const xLabelInterval = scale === 'month' ? (height >= 250 ? 4 : 5) : 1;

  const points = useMemo(() => data.map((d, i) => ({
    x: padLeft + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padTop + chartH - (d.value / yMax) * chartH,
    ...d,
  })), [chartH, chartW, data, yMax]);
  const {
    activeIndex,
    activeItem: activePoint,
    activate: setActiveIndex,
    clear: clearActiveIndex,
  } = useActiveChartItem(points);

  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-[var(--text-muted)]" style={{ height }}>暂无数据</div>;
  }

  const linePath = buildMonotoneCurvePath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;
  const tooltipWidth = 144;
  const tooltipHeight = 68;
  const tooltipPosition = activePoint
    ? getBoundedTooltipPosition({
        anchorX: activePoint.x,
        anchorY: activePoint.y,
        containerWidth: svgWidth,
        containerHeight: height,
        tooltipWidth,
        tooltipHeight,
      })
    : { left: 0, top: 0 };
  const gradientId = `${idPrefix}-area-gradient`;
  const strokeId = `${idPrefix}-stroke-gradient`;
  const glowId = `${idPrefix}-glow`;

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onMouseLeave={clearActiveIndex}
    >
      <svg width="100%" height={height} className="block select-none" role="img" aria-label="观看趋势图">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-area-top)" />
            <stop offset="55%" stopColor="var(--chart-area-mid)" />
            <stop offset="100%" stopColor="var(--chart-area-bottom)" />
          </linearGradient>
          <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--chart-line-start)" />
            <stop offset="100%" stopColor="var(--chart-line-end)" />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

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

        {activePoint ? (
          <rect
            x={activeIndex === 0 ? padLeft : (points[activeIndex! - 1].x + activePoint.x) / 2}
            y={padTop}
            width={(activeIndex === points.length - 1 ? padLeft + chartW : (activePoint.x + points[activeIndex! + 1].x) / 2) - (activeIndex === 0 ? padLeft : (points[activeIndex! - 1].x + activePoint.x) / 2)}
            height={chartH}
            rx={8}
            fill="var(--chart-area-top)"
            opacity={0.32}
            className="pointer-events-none"
          />
        ) : null}

        <path d={areaPath} fill={`url(#${gradientId})`} opacity={0.92} />
        <path
          d={linePath}
          fill="none"
          stroke={`url(#${strokeId})`}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />

        {activePoint ? (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padTop}
            y2={padTop + chartH}
            stroke="var(--chart-tooltip-border)"
            strokeWidth={1}
            strokeDasharray="3,4"
            className="pointer-events-none"
          />
        ) : null}

        {points.map((p, i) => (
          <circle
            key={`dot-${i}`}
            cx={p.x}
            cy={p.y}
            r={activeIndex === i ? 7 : 4}
            fill={activeIndex === i ? 'var(--chart-dot-hover)' : 'var(--chart-dot)'}
            stroke={activeIndex === i ? 'var(--chart-dot-hover-stroke)' : 'var(--chart-dot-stroke)'}
            strokeWidth={2}
            className="pointer-events-none transition-all duration-150"
          />
        ))}

        {points.filter((_, i) => i % xLabelInterval === 0).map((p) => (
          <text key={p.label} x={p.x} y={height - 4} textAnchor="middle" fill="var(--chart-axis-x)" fontSize={10}>{p.label}</text>
        ))}

        {points.map((p, i) => {
          const left = i === 0 ? padLeft : (points[i - 1].x + p.x) / 2;
          const right = i === points.length - 1 ? padLeft + chartW : (p.x + points[i + 1].x) / 2;
          return (
            <rect
              key={`hit-${i}`}
              x={left}
              y={padTop}
              width={Math.max(right - left, 1)}
              height={chartH}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${p.label}，观看 ${p.value} 集`}
              onMouseEnter={() => setActiveIndex(i)}
              onFocus={() => setActiveIndex(i)}
              onBlur={clearActiveIndex}
              onPointerDown={() => setActiveIndex(i)}
              style={{ cursor: 'crosshair', outline: 'none' }}
            />
          );
        })}
      </svg>

      {activePoint ? (
        <ChartTooltip
          label={activePoint.label}
          value={activePoint.value}
          unit="集"
          emphasis
          className="left-0 top-0"
          style={{ left: tooltipPosition.left, right: 'auto', top: tooltipPosition.top, width: tooltipWidth }}
        />
      ) : null}
    </div>
  );
}
