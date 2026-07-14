"use client";

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { EnrichedEntry } from './TimelineEnhancedList';
import { TimelineSortBy } from './TimelineControls';

interface TimelineTableProps {
  entries: EnrichedEntry[];
  searchQuery: string;
  sortBy: TimelineSortBy;
  onSortByChange: (sort: TimelineSortBy) => void;
}

type SortColumn = 'date' | 'anime' | 'episode' | 'progress';

function getSortIcon(currentSort: TimelineSortBy, column: SortColumn): boolean {
  const map: Record<TimelineSortBy, SortColumn> = {
    newest: 'date',
    oldest: 'date',
    mostEpisodes: 'episode',
  };
  return map[currentSort] === column;
}

export default memo(function TimelineTable({ entries, searchQuery, sortBy, onSortByChange }: TimelineTableProps) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      e.history.animeTitle.toLowerCase().includes(q) ||
      (e.anime?.originalTitle?.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  // Sort entries
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'newest':
        arr.sort((a, b) => b.history.dateObj.getTime() - a.history.dateObj.getTime());
        break;
      case 'oldest':
        arr.sort((a, b) => a.history.dateObj.getTime() - b.history.dateObj.getTime());
        break;
      case 'mostEpisodes':
        arr.sort((a, b) => b.history.episode - a.history.episode);
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  const handleSortClick = (column: SortColumn) => {
    const map: Record<SortColumn, TimelineSortBy> = {
      date: sortBy === 'newest' ? 'oldest' : 'newest',
      anime: 'newest',
      episode: sortBy === 'mostEpisodes' ? 'newest' : 'mostEpisodes',
      progress: 'mostEpisodes',
    };
    onSortByChange(map[column]);
  };

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <th
      className="px-4 py-3 text-left cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none"
      onClick={() => handleSortClick(column)}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {label}
        {getSortIcon(sortBy, column) && <ChevronUpDownIcon className="w-3 h-3" />}
      </span>
    </th>
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-3xl">
        <span className="text-4xl mb-4 block">📋</span>
        <p>{searchQuery ? '没有匹配的记录' : '暂无观看记录'}</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-[28px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <SortHeader column="date" label="时间" />
              <SortHeader column="anime" label="番剧" />
              <SortHeader column="episode" label="集数" />
              <SortHeader column="progress" label="进度" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ history: h, anime }) => (
              <tr
                key={h.id}
                className="border-b border-[var(--border-light)] hover:bg-[var(--tag-bg)]/50 transition-colors group"
              >
                {/* Date */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm text-[var(--text-primary)] font-mono">
                      {h.dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {h.dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </td>

                {/* Anime */}
                <td className="px-4 py-3">
                  <Link
                    href={`/anime/${h.animeId}`}
                    className="text-sm text-[var(--text-primary)] hover:text-primary transition-colors font-medium truncate block max-w-[240px]"
                  >
                    {h.animeTitle}
                  </Link>
                  {anime?.originalTitle && (
                    <span className="text-[11px] text-[var(--text-muted)] truncate block max-w-[240px]">
                      {anime.originalTitle}
                    </span>
                  )}
                </td>

                {/* Episode */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="surface-pill text-xs font-mono px-2.5 py-1 rounded-full">
                    EP {h.episode}
                  </span>
                </td>

                {/* Progress */}
                <td className="px-4 py-3">
                  {anime?.totalEpisodes && anime.totalEpisodes > 0 ? (
                    <div className="flex items-center gap-2 min-w-[120px] max-w-[180px]">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-card)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (h.episode / anime.totalEpisodes) * 100)}%`,
                            background: 'linear-gradient(to right, var(--chart-line-start), var(--chart-line-end))',
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                        {h.episode}/{anime.totalEpisodes}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)] font-mono">
          共 {sorted.length} 条记录
        </span>
      </div>
    </div>
  );
});
