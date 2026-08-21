"use client";

import { memo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { TimelineAnimeSummaryData } from '@/lib/timeline-types';
import Panel from '@/components/shared/Panel';
import EmptyState from '@/components/shared/EmptyState';

const SUMMARY_PAGE_SIZE = 10;

interface TimelineAnimeSummaryProps {
  summaries: TimelineAnimeSummaryData[];
  searchQuery: string;
  selectedDate?: string | null;
}
export default memo(function TimelineAnimeSummary({ summaries, searchQuery, selectedDate = null }: TimelineAnimeSummaryProps) {
  const [page, setPage] = useState(1);
  const hasFilter = Boolean(searchQuery || selectedDate);

  const totalPages = Math.max(1, Math.ceil(summaries.length / SUMMARY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSummaries = summaries.slice((safePage - 1) * SUMMARY_PAGE_SIZE, safePage * SUMMARY_PAGE_SIZE);

  // Reset page when the active filter changes.
  useEffect(() => { setPage(1); }, [searchQuery, selectedDate]);

  if (summaries.length === 0) {
    return (
      <EmptyState
        title={hasFilter ? '没有匹配的作品' : '暂无最近观看'}
        description={hasFilter ? '当前筛选条件没有匹配到观看记录。' : '产生观看记录后，这里会显示最近看过的作品。'}
        size="compact"
        surface="panel"
        className="min-h-[200px]"
      />
    );
  }

  const totalAnime = summaries.length;

  return (
    <Panel
      title={selectedDate ? '当日观看作品' : '最近观看作品'}
      description={(
        <>
          {totalAnime} 部番剧 · 按最近观看时间排序
          {totalPages > 1 && <span> · 第 {safePage}/{totalPages} 页</span>}
        </>
      )}
      size="flush"
      overflow="hidden"
      className="flex h-full flex-col"
      headerClassName="mb-0 border-b border-[var(--border)] p-5 md:p-6"
      contentClassName="flex min-h-0 flex-1 flex-col"
    >

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-[var(--border-light)]">
        {pagedSummaries.map((s, index) => {
          const lastWatched = new Date(s.lastWatched);
          const daysSince = Math.floor((Date.now() - lastWatched.getTime()) / 86400000);
          const lastWatchLabel = daysSince === 0 ? '今天' : daysSince === 1 ? '昨天' : `${daysSince}天前`;
          const rank = (safePage - 1) * SUMMARY_PAGE_SIZE + index + 1;

          return (
            <Link
              key={s.animeId}
              href={`/anime/${s.animeId}`}
              className="flex items-start gap-3 px-5 md:px-6 py-3.5 hover:bg-[var(--tag-bg)]/50 transition-colors group"
            >
              {/* Cover */}
              <div
                className="shrink-0 w-10 h-14 rounded-md bg-cover bg-center bg-[var(--tag-bg)]"
                style={s.coverUrl ? { backgroundImage: `url(${s.coverUrl})` } : undefined}
              >
                {!s.coverUrl && (
                  <div className="flex h-full w-full items-center justify-center text-[8px] text-[var(--text-muted)]">
                    无封面
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[10px] font-bold font-mono text-primary">#{rank}</span>
                    <span className="truncate text-sm font-medium text-[var(--text-primary)] transition-colors group-hover:text-primary">
                      {s.title}
                    </span>
                  </div>
                  <span className="shrink-0 text-[11px] font-mono text-[var(--text-muted)]">
                    最近 EP {s.lastEpisode}
                  </span>
                </div>

                {s.originalTitle && (
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{s.originalTitle}</p>
                )}

                {/* Meta row */}
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--text-muted)] font-mono">
                  <span>{lastWatchLabel}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span>共 {s.totalWatched} 条记录</span>
                  <span className="text-[var(--border)]">·</span>
                  <span className={`${
                    s.status === 'watching' ? 'text-[var(--color-watching)]' :
                    s.status === 'completed' ? 'text-[var(--color-completed)]' :
                    s.status === 'dropped' ? 'text-[var(--color-dropped)]' : 'text-[var(--color-plan)]'
                  }`}>
                    {s.status === 'watching' ? '追番中' :
                     s.status === 'completed' ? '已看完' :
                     s.status === 'dropped' ? '弃坑' : '计划'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 md:px-6 py-3 border-t border-[var(--border)] shrink-0">
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {summaries.length} 部
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-md text-[11px] font-mono font-bold transition-all ${
                  p === safePage
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tag-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
});
