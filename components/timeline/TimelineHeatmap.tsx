"use client";

import { memo, useMemo, useState } from 'react';
import { ParsedWatchHistory } from '@/lib/dashboard-types';
import ChartTooltip from '@/components/shared/ChartTooltip';
import Panel from '@/components/shared/Panel';
import { getBoundedTooltipPosition } from '@/components/shared/chart-utils';

interface TimelineHeatmapProps {
  history: ParsedWatchHistory[];
  months?: number; // default 12, for compact mode pass e.g. 6
}

const LEVEL_COLORS = [
  'var(--heatmap-0)',
  'var(--heatmap-1)',
  'var(--heatmap-2)',
  'var(--heatmap-3)',
  'var(--heatmap-4)',
];

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// Fixed cell sizing — large enough to look good, may scroll horizontally on narrow containers
const CELL_SIZE = 20;
const CELL_GAP = 6;
const CELL_STEP = CELL_SIZE + CELL_GAP;

export default memo(function TimelineHeatmap({ history, months = 12 }: TimelineHeatmapProps) {
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const { cells, monthMarkers, totalDays, activeDays, maxInDay, totalWeeks } = useMemo(() => {
    const countMap: Record<string, number> = {};
    for (const h of history) {
      countMap[h.dateStr] = (countMap[h.dateStr] || 0) + 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from N months ago, align to Monday
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    const startDay = startDate.getDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + mondayOffset);

    const weeks = Math.ceil((today.getTime() - startDate.getTime()) / (7 * 86400000)) + 1;
    const cellsArr: { date: Date; dateStr: string; count: number; level: number; weekIdx: number; dayIdx: number; isToday: boolean }[] = [];
    const monthMarkersArr: { label: string; weekIdx: number }[] = [];
    let lastMonth = -1;

    let active = 0;
    let total = 0;
    let maxCount = 0;
    const todayStr = today.toISOString().split('T')[0];

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        const dateStr = date.toISOString().split('T')[0];
        const count = countMap[dateStr] || 0;

        if (date > today) {
          cellsArr.push({ date, dateStr, count: -1, level: -1, weekIdx: w, dayIdx: d, isToday: false });
          continue;
        }

        total++;
        if (count > 0) active++;
        if (count > maxCount) maxCount = count;

        const month = date.getMonth();
        if (month !== lastMonth) {
          monthMarkersArr.push({ label: MONTH_LABELS[month], weekIdx: w });
          lastMonth = month;
        }

        cellsArr.push({ date, dateStr, count, level: getLevel(count), weekIdx: w, dayIdx: d, isToday: dateStr === todayStr });
      }
    }

    return { cells: cellsArr, monthMarkers: monthMarkersArr, totalDays: total, activeDays: active, maxInDay: maxCount, totalWeeks: weeks };
  }, [history, months]);

  // Layout — fixed cell size, horizontal scroll if needed
  const dayLabelWidth = 48;
  const rightPad = 16;
  const topPad = 28;
  const bottomPad = 20;
  const cellSize = CELL_SIZE;
  const cellGap = CELL_GAP;
  const cellStep = CELL_STEP;
  const chartW = totalWeeks * cellStep - cellGap;
  const chartH = 7 * cellStep - cellGap;
  const totalW = dayLabelWidth + chartW + rightPad;
  const totalH = topPad + chartH + bottomPad;
  const activeCell = activeDate ? cells.find((cell) => cell.dateStr === activeDate) ?? null : null;
  const tooltipWidth = 138;
  const tooltipHeight = 58;
  const activeCellY = activeCell ? topPad + activeCell.dayIdx * cellStep : 0;
  const tooltipPosition = activeCell
    ? getBoundedTooltipPosition({
        anchorX: dayLabelWidth + activeCell.weekIdx * cellStep + cellSize / 2,
        anchorY: activeCellY,
        containerWidth: totalW,
        containerHeight: totalH,
        tooltipWidth,
        tooltipHeight,
        gap: 8,
      })
    : { left: 0, top: 0 };

  return (
    <Panel
      title="观看热力图"
      description={`过去 ${months} 个月 · ${activeDays} / ${totalDays} 天有记录 · 单日最多 ${maxInDay} 集`}
      action={(
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-muted)]">少</span>
          {LEVEL_COLORS.map((color, level) => (
            <div key={level} className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: color }} />
          ))}
          <span className="text-[10px] text-[var(--text-muted)]">多</span>
        </div>
      )}
      headerClassName="mb-2"
    >

      {/* SVG */}
      <div className="overflow-x-auto">
        <div
          className="relative"
          style={{ minWidth: totalW, width: totalW, height: totalH }}
          onMouseLeave={() => setActiveDate(null)}
        >
        <svg width={totalW} height={totalH} className="select-none" viewBox={`0 0 ${totalW} ${totalH}`} role="img" aria-label="观看热力图">
          {/* Month labels */}
          {monthMarkers.map((m, mi) => {
            const nextMarker = monthMarkers[mi + 1];
            // Span from this month's start week to next month's start week (or end)
            const startX = dayLabelWidth + m.weekIdx * cellStep;
            const endX = nextMarker ? dayLabelWidth + nextMarker.weekIdx * cellStep - cellGap : dayLabelWidth + chartW;
            const midX = (startX + endX) / 2;
            const width = endX - startX;
            // Only show label if there's enough room
            if (width < 20) return null;
            return (
              <text
                key={`m-${mi}`}
                x={midX}
                y={topPad - 10}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize={11}
                fontWeight={600}
              >
                {m.label}
              </text>
            );
          })}

          {/* Day labels */}
          {DAY_LABELS.map((label, di) => {
            const y = topPad + di * cellStep + cellSize / 2 + 4;
            // Dim weekends slightly
            const isWeekend = di >= 5;
            return (
              <text
                key={`d-${di}`}
                x={dayLabelWidth - 10}
                y={y}
                textAnchor="end"
                fill={isWeekend ? 'var(--text-muted)' : 'var(--text-secondary)'}
                fontSize={11}
                fontWeight={isWeekend ? 400 : 500}
              >
                {label}
              </text>
            );
          })}

          {/* Cells */}
          {cells.map((cell) => {
            if (cell.level < 0) return null;
            const x = dayLabelWidth + cell.weekIdx * cellStep;
            const y = topPad + cell.dayIdx * cellStep;
            const color = LEVEL_COLORS[cell.level];

            return (
              <g key={`${cell.weekIdx}-${cell.dayIdx}`} className="group">
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={cellSize >= 12 ? 3 : 2}
                  fill={color}
                  stroke={activeDate === cell.dateStr || cell.isToday ? 'var(--chart-line-start)' : 'transparent'}
                  strokeWidth={activeDate === cell.dateStr ? 2.5 : cell.isToday ? 1.5 : 0}
                  className="transition-colors duration-150"
                />
                {/* Wider hit area */}
                <rect
                  x={x - 2}
                  y={y - 2}
                  width={cellSize + 4}
                  height={cellSize + 4}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${cell.dateStr} ${DAY_LABELS[cell.dayIdx]}，观看 ${cell.count} 集`}
                  onMouseEnter={() => setActiveDate(cell.dateStr)}
                  onFocus={() => setActiveDate(cell.dateStr)}
                  onBlur={() => setActiveDate(null)}
                  onPointerDown={() => setActiveDate(cell.dateStr)}
                  style={{ cursor: 'pointer', outline: 'none' }}
                />
              </g>
            );
          })}
        </svg>
        {activeCell ? (
          <ChartTooltip
            label={`${activeCell.dateStr} ${DAY_LABELS[activeCell.dayIdx]}`}
            value={activeCell.count}
            unit="集"
            className="left-0 top-0"
            style={{ left: tooltipPosition.left, right: 'auto', top: tooltipPosition.top, width: tooltipWidth }}
          />
        ) : null}
        </div>
      </div>
    </Panel>
  );
});
