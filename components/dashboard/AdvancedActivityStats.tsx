"use client";

import { memo, useMemo, useState } from 'react';
import { AnimeRecord, ParsedWatchHistory } from '@/lib/dashboard-types';

/** Inline SVG line chart — replacing echarts for ~800KB bundle savings */
function ActivityLineChart({ data, maxValue, scale }: { data: { label: string; value: number }[]; maxValue: number; scale: 'week' | 'month' | 'year' }) {
  const W = 600;
  const H = 250;
  const padLeft = 34;
  const padRight = 12;
  const padTop = 16;
  const padBottom = scale === 'month' ? 30 : 18;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const yMax = maxValue < 4 ? 4 : maxValue;

  if (data.length === 0) {
    return <div className="flex h-[250px] items-center justify-center text-sm text-zinc-500">暂无数据</div>;
  }

  // Build path and points
  const points = data.map((d, i) => {
    const x = padLeft + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padTop + chartH - (d.value / yMax) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;

  const yTicks = 3;
  const xLabelInterval = scale === 'month' ? 4 : 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[250px] w-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(192,132,252,0.28)" />
          <stop offset="55%" stopColor="rgba(129,140,248,0.08)" />
          <stop offset="100%" stopColor="rgba(109,40,217,0)" />
        </linearGradient>
        <filter id="glow">
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
            <line x1={padLeft} x2={W - padRight} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeDasharray="4,4" />
            <text x={padLeft - 6} y={y + 3} textAnchor="end" fill="#6b7b76" fontSize={10}>{val}</text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#lineGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="url(#lineStrokeGrad)" strokeWidth={2.5} filter="url(#glow)" />

      {/* Line gradient stroke (defined inline because it needs x coordinates) */}
      <defs>
        <linearGradient id="lineStrokeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>

      {/* Dots */}
      {points.map((p, i) => (
        <g key={i} className="group">
          <circle cx={p.x} cy={p.y} r={6} fill="#c084fc" stroke="#0d1117" strokeWidth={2}
            className="transition-all hover:r-8 hover:fill-[#e9d5ff] hover:stroke-white" />
          {/* Tooltip on hover */}
          <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
            <rect x={p.x - 36} y={p.y - 40} width={72} height={36} rx={10}
              fill="rgba(8,14,13,0.96)" stroke="rgba(125,211,252,0.28)" strokeWidth={1} />
            <text x={p.x} y={p.y - 22} textAnchor="middle" fill="#f8fafc" fontSize={16} fontWeight={600}>{p.value} EP</text>
            <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#cbd5e1" fontSize={10}>{p.label}</text>
          </g>
        </g>
      ))}

      {/* X-axis labels */}
      {points.filter((_, i) => i % xLabelInterval === 0).map((p) => (
        <text key={p.label} x={p.x} y={H - 4} textAnchor="middle" fill="#7c8a86" fontSize={10}>{p.label}</text>
      ))}
    </svg>
  );
}

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
          <h2 className="text-2xl font-display font-semibold flex items-center gap-3 text-zinc-100">
            <span className="w-1.5 h-8 bg-gradient-to-b from-cyan-300 to-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]"></span>
            观影趋势分析
          </h2>
          <p className="text-sm text-zinc-400 mt-2 leading-6">{statsData.title}，现在会额外给出高频观看时段和这一段时间对整库的推进占比。</p>
        </div>

        <div className="surface-card-muted flex p-1.5 rounded-2xl shadow-xl self-start lg:self-auto">
          {(['week', 'month', 'year'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${scale === s ? 'bg-zinc-800 text-primary shadow-lg ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {s === 'week' ? '周' : s === 'month' ? '月' : '年'}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="surface-card-muted grid grid-cols-2 xl:grid-cols-4 divide-x divide-white/[0.06] rounded-2xl px-1 py-3">
        {[
          ['总看番集数', statsData.totalEpisodes, 'EP', 'text-zinc-100'],
          ['预估时长', Math.round(statsData.totalMinutes / 60), 'HRS', 'text-blue-400'],
          ['活跃效率', (statsData.totalEpisodes / averagePerUnit).toFixed(1), 'EP/D', 'text-green-400'],
          ['高频时段', statsData.mostActiveWindow[0], `× ${statsData.mostActiveWindow[1]}`, 'text-amber-300'],
        ].map(([label, val, unit, colorClass]) => (
          <div key={label as string} className="flex flex-col gap-1 px-5 first:pl-0">
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{label}</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-bold font-mono tracking-tighter ${colorClass}`}>{val}</span>
              <span className="text-xs text-zinc-500 font-bold">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + side panels */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-5">
        <div className="surface-card h-[320px] rounded-[28px] bg-[linear-gradient(180deg,rgba(8,14,13,0.66),rgba(7,11,11,0.3))] p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Viewer Activity</div>
            <div className="hidden md:flex rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-violet-200/75">
              {scale === 'week' ? '7 Day Window' : scale === 'month' ? 'Monthly Timeline' : 'Yearly Timeline'}
            </div>
          </div>
          <ActivityLineChart data={statsData.data} maxValue={maxValue} scale={scale} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 xl:flex xl:flex-col gap-2 xl:h-64">
          {[
            ['Peak Point', statsData.peakPoint.label, `max ${statsData.peakPoint.value} EP`, 'text-zinc-100'],
            ['Active Days', statsData.activeDays, '有记录天', 'text-emerald-300'],
            ['Library Cov.', `${statsData.libraryCoverage}%`, '整库占比', 'text-cyan-300'],
          ].map(([label, val, sub, colorClass]) => (
            <div key={label as string} className="surface-card-muted flex-1 px-4 py-3 flex flex-col justify-between border-l border-white/[0.06] rounded-xl">
              <div className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">{label}</div>
              <div className="flex items-end justify-between gap-2">
                <span className={`text-xl font-mono leading-tight ${colorClass}`}>{val}</span>
                <span className="text-[10px] text-zinc-500 font-mono pb-0.5">{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
