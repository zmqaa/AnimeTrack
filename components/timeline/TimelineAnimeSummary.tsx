"use client";

import { memo, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { PlayIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { EnrichedEntry } from './TimelineEnhancedList';

const SUMMARY_PAGE_SIZE = 10;

interface TimelineAnimeSummaryProps {
  entries: EnrichedEntry[];
  searchQuery: string;
}

interface AnimeSummary {
  animeId: number;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  status: string;
  totalWatched: number;
  latestEpisode: number;
  totalEpisodes?: number;
  firstWatched: Date;
  lastWatched: Date;
  sessionCount: number;
}

export default memo(function TimelineAnimeSummary({ entries, searchQuery }: TimelineAnimeSummaryProps) {
  const [page, setPage] = useState(1);

  const summaries = useMemo(() => {
    const map = new Map<number, AnimeSummary>();

    for (const { history: h, anime } of entries) {
      let summary = map.get(h.animeId);
      if (!summary) {
        summary = {
          animeId: h.animeId,
          title: h.animeTitle,
          originalTitle: anime?.originalTitle,
          coverUrl: anime?.coverUrl,
          status: anime?.status ?? 'watching',
          totalWatched: 0,
          latestEpisode: 0,
          totalEpisodes: anime?.totalEpisodes ?? undefined,
          firstWatched: h.dateObj,
          lastWatched: h.dateObj,
          sessionCount: 0,
        };
        map.set(h.animeId, summary);
      }

      summary.totalWatched++;
      if (h.episode > summary.latestEpisode) summary.latestEpisode = h.episode;
      if (h.dateObj < summary.firstWatched) summary.firstWatched = h.dateObj;
      if (h.dateObj > summary.lastWatched) summary.lastWatched = h.dateObj;
      summary.sessionCount++;
    }

    // Apply search filter
    let result = Array.from(map.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        s => s.title.toLowerCase().includes(q) ||
             s.originalTitle?.toLowerCase().includes(q)
      );
    }

    // Sort by total watched descending
    result.sort((a, b) => b.totalWatched - a.totalWatched);

    return result;
  }, [entries, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(summaries.length / SUMMARY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedSummaries = summaries.slice((safePage - 1) * SUMMARY_PAGE_SIZE, safePage * SUMMARY_PAGE_SIZE);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [searchQuery]);

  if (summaries.length === 0) {
    return (
      <div className="glass-panel rounded-[28px] p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-[var(--text-muted)]">暂无数据</p>
      </div>
    );
  }

  const totalWatchedAll = summaries.reduce((s, a) => s + a.totalWatched, 0);
  const totalAnime = summaries.length;

  return (
    <div className="glass-panel rounded-[28px] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-5 md:p-6 border-b border-[var(--border)]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
          <span className="w-1.5 h-4 rounded-full" style={{ background: 'linear-gradient(to bottom, var(--chart-line-start), var(--chart-line-end))' }} />
          按番剧汇总
        </h2>
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
          {totalAnime} 部番剧 · 共 {totalWatchedAll} 集记录
          {totalPages > 1 && <span> · 第 {safePage}/{totalPages} 页</span>}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-[var(--border-light)]">
        {pagedSummaries.map((s) => {
          const progressPercent = s.totalEpisodes && s.totalEpisodes > 0
            ? Math.min(100, Math.round((s.latestEpisode / s.totalEpisodes) * 100))
            : s.status === 'completed' ? 100 : 0;

          const daysSince = Math.floor((Date.now() - s.lastWatched.getTime()) / 86400000);
          const lastWatchLabel = daysSince === 0 ? '今天' : daysSince === 1 ? '昨天' : `${daysSince}天前`;

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
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                    <PlayIcon className="w-4 h-4" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-primary transition-colors truncate">
                    {s.title}
                  </span>
                  <span className="shrink-0 text-[11px] font-mono text-[var(--text-muted)]">
                    {s.totalWatched}集
                  </span>
                </div>

                {s.originalTitle && (
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{s.originalTitle}</p>
                )}

                {/* Progress bar */}
                {s.totalEpisodes && s.totalEpisodes > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-[var(--bg-card)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progressPercent}%`,
                          background: progressPercent >= 100
                            ? 'var(--color-completed)'
                            : 'linear-gradient(to right, var(--chart-line-start), var(--chart-line-end))',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                      {s.latestEpisode}/{s.totalEpisodes}
                    </span>
                  </div>
                )}

                {/* Meta row */}
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-[var(--text-muted)] font-mono">
                  <span>{s.firstWatched.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} 起</span>
                  <span className="text-[var(--border)]">·</span>
                  <span>{lastWatchLabel}</span>
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
    </div>
  );
});
