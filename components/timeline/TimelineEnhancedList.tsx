"use client";

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { ParsedWatchHistory, AnimeRecord } from '@/lib/dashboard-types';
import ProgressBar from '@/components/shared/ProgressBar';
import EmptyState from '@/components/shared/EmptyState';

export interface EnrichedEntry {
  history: ParsedWatchHistory;
  anime?: AnimeRecord;
}

interface TimelineEnhancedListProps {
  entries: EnrichedEntry[];
  groupBy: 'day' | 'week' | 'month';
  searchQuery: string;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function getWeekKey(date: Date): string {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  // Monday of this week
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

  // ISO week: the week containing Thursday determines the year
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();

  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay();
  const week1Monday = new Date(jan4);
  week1Monday.setDate(4 - jan4Day + (jan4Day === 0 ? -6 : 1));

  const daysDiff = Math.round((monday.getTime() - week1Monday.getTime()) / 86400000);
  const weekNum = Math.floor(daysDiff / 7) + 1;

  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekLabel(weekKey: string): string {
  const [year, weekStr] = weekKey.split('-W');
  return `${year}年 第${parseInt(weekStr)}周`;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

function getMonthLabel(dateStr: string): string {
  const [year, month] = dateStr.split('-');
  return `${year}年${parseInt(month)}月`;
}

function Pagination({ page, totalPages, totalItems, onPageChange }: {
  page: number; totalPages: number; totalItems: number; onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  // Build page numbers to show: current ± 2, with 1 and last
  const pages: (number | '...')[] = [];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  pages.push(1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('...');
  if (totalPages > 1) pages.push(totalPages);

  return (
    <div className="flex items-center justify-between pt-6 border-t border-[var(--border)] mt-8">
      <span className="text-[11px] text-[var(--text-muted)] font-mono">
        共 {totalItems} 条 · 第 {page}/{totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="w-8 text-center text-[var(--text-muted)] text-xs">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition-all ${
                p === page
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)]'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default memo(function TimelineEnhancedList({ entries, groupBy, searchQuery, page, pageSize, onPageChange }: TimelineEnhancedListProps) {
  // Filter by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      e.history.animeTitle.toLowerCase().includes(q) ||
      (e.anime?.originalTitle?.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  // Paginate flat entries, then group
  const { grouped, totalPages, totalFiltered } = useMemo(() => {
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pages);
    const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    const groups: { key: string; label: string; entries: EnrichedEntry[] }[] = [];
    const groupMap = new Map<string, EnrichedEntry[]>();

    for (const entry of slice) {
      let key: string;
      if (groupBy === 'day') {
        key = entry.history.dateStr;
      } else if (groupBy === 'week') {
        key = getWeekKey(entry.history.dateObj);
      } else {
        key = entry.history.dateStr.substring(0, 7);
      }
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(entry);
    }

    for (const [key, items] of groupMap) {
      let label: string;
      if (groupBy === 'day') {
        label = getDayLabel(key);
      } else if (groupBy === 'week') {
        label = getWeekLabel(key);
      } else {
        label = getMonthLabel(key);
      }
      groups.push({ key, label, entries: items });
    }
    return { grouped: groups, totalPages: pages, totalFiltered: total };
  }, [filtered, groupBy, page, pageSize]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        title={searchQuery ? '没有匹配的记录' : '暂无观看记录'}
        description={searchQuery ? '试试缩短关键词，或清除搜索条件。' : '去更新一下番剧进度，观看记录会自动出现在这里。'}
        surface="panel"
      />
    );
  }

  return (
    <div className="glass-panel rounded-[28px] p-5 md:p-6">
      <div className="relative ml-4 space-y-12 border-l-2 border-[var(--border)] py-4 pl-6 xl:ml-5 xl:pl-8">
        {grouped.map((group) => (
          <div key={group.key} className="relative">
            {/* Timeline dot + date badge */}
            <div className="absolute -left-[45px] top-0 flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-card)] border-2 border-[var(--border)] z-10">
              <CalendarIcon className="w-4 h-4 text-primary" />
            </div>

            <div className="mb-6 flex items-center gap-3">
              <h2 className="surface-pill rounded-xl px-3 py-1.5 text-base font-bold text-[var(--text-primary)]">
                {group.label}
              </h2>
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {group.entries.length} 集
              </span>
            </div>

            <div className="space-y-3">
              {group.entries.map(({ history: h, anime }) => (
                <div key={h.id} className="group relative">
                  {/* Dot on timeline */}
                  <div
                    className="absolute -left-[38px] top-2 w-3 h-3 rounded-full bg-[var(--tag-bg)] group-hover:bg-primary transition-colors border-2 border-[var(--bg-page)]"
                    style={{ boxShadow: 'var(--shadow-sm)' }}
                  />

                  {/* Time */}
                  <span className="block text-xs font-mono text-[var(--text-muted)] mb-2">
                    {h.dateObj.toLocaleDateString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Card */}
                  <Link
                    href={`/anime/${h.animeId}`}
                    className="surface-card-muted p-3.5 rounded-xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 flex gap-3 items-start"
                  >
                      {/* Cover thumbnail */}
                      <div
                        className="shrink-0 w-11 h-16 rounded-lg bg-cover bg-center bg-[var(--tag-bg)]"
                        style={anime?.displayCoverUrl ? { backgroundImage: `url(${anime.displayCoverUrl})` } : undefined}
                      >
                        {!anime?.displayCoverUrl && (
                          <div className="flex h-full w-full items-center justify-center text-[8px] text-[var(--text-muted)]">
                            无封面
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-[var(--text-primary)] font-medium group-hover:text-primary transition-colors truncate">
                            {h.animeTitle}
                          </span>
                          <span className="shrink-0 text-[10px] font-mono bg-[var(--color-surface-raised)] px-2 py-1 rounded-full text-[var(--text-muted)]">
                            EP {h.episode}
                          </span>
                        </div>

                        {/* Progress info */}
                        {anime && anime.totalEpisodes && anime.totalEpisodes > 0 && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <ProgressBar
                              className="flex-1"
                              value={(h.episode / anime.totalEpisodes) * 100}
                              size="xs"
                              label={`${anime.title} 观看进度`}
                            />
                            <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                              {h.episode}/{anime.totalEpisodes}
                            </span>
                          </div>
                        )}

                        {/* Status + original title */}
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          {anime && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              anime.status === 'watching' ? 'status-watching-soft' :
                              anime.status === 'completed' ? 'status-completed-soft' :
                              anime.status === 'dropped' ? 'status-dropped-soft' :
                              'status-plan-soft'
                            }`}>
                              {anime.status === 'watching' ? '追番中' :
                               anime.status === 'completed' ? '已看完' :
                               anime.status === 'dropped' ? '已弃坑' : '计划看'}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={totalFiltered}
        onPageChange={onPageChange}
      />
    </div>
  );
});
