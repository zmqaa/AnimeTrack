"use client";

import { useMemo } from 'react';

interface ChartItem {
  label: string;
  value: number;
  color?: string;
}

interface YearBarChartProps {
  data: ChartItem[];
  height?: number;
}

export function YearBarChart({ data, height = 220 }: YearBarChartProps) {
  const chartData = useMemo(() => {
    return [...data].sort((a, b) => {
      const yearA = parseInt(a.label);
      const yearB = parseInt(b.label);
      if (!isNaN(yearA) && !isNaN(yearB)) return yearA - yearB;
      return a.label.localeCompare(b.label);
    });
  }, [data]);

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const barWidth = Math.max(12, Math.min(24, 100 / chartData.length - 8));
  const chartAreaHeight = height - 40;

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <svg width="100%" height={height} className="select-none">
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 12 + chartAreaHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={20} x2="100%" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4,4" />
              <text x={16} y={y + 3} textAnchor="end" fill="#64748b" fontSize={9}>
                {Math.round(maxVal * ratio)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {chartData.map((d, i) => {
          const barH = Math.max(2, (d.value / maxVal) * chartAreaHeight);
          const barX = 28 + i * ((100 - 28) / chartData.length);
          const barY = 12 + chartAreaHeight - barH;
          const color = d.color || '#5dd6f2';
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
                rx={4}
                fill={`url(#${barId})`}
                className="transition-all duration-200 hover:brightness-125"
              />
              {/* Label */}
              <text
                x={barX + barWidth / 2}
                y={height - 6}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={9}
              >
                {labelText}
              </text>
              {/* Hover area (wider than the bar for easier targeting) */}
              <rect
                x={barX - 4}
                y={0}
                width={barWidth + 8}
                height={height - 18}
                fill="transparent"
                className="peer"
              />
              {/* Tooltip on hover */}
              <foreignObject
                x={barX + barWidth / 2 - 60}
                y={barY - 60}
                width={120}
                height={56}
                className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100"
                style={{ overflow: 'visible' }}
              >
                <div className="rounded-xl border border-white/10 bg-[#080e0d]/95 px-3 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] text-center">
                  <div className="text-[10px] uppercase text-slate-400">{labelText}</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-100">{d.value} 部</div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
