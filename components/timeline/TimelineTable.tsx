"use client";

import { memo } from 'react';
import Link from 'next/link';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { EnrichedEntry } from './TimelineEnhancedList';
import { TimelinePagination } from './TimelineEnhancedList';
import { TimelineSortBy } from './TimelineControls';
import ProgressBar from '@/components/shared/ProgressBar';
import EmptyState from '@/components/shared/EmptyState';
import { APP_TIME_ZONE } from '@/lib/date-utils';

interface TimelineTableProps {
  entries: EnrichedEntry[];
  hasSearch: boolean;
  sortBy: TimelineSortBy;
  onSortByChange: (sort: TimelineSortBy) => void;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
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

export default memo(function TimelineTable({
  entries,
  hasSearch,
  sortBy,
  onSortByChange,
  page,
  totalPages,
  totalItems,
  onPageChange,
}: TimelineTableProps) {
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

  if (entries.length === 0) {
    return (
      <EmptyState
        title={hasSearch ? '没有匹配的记录' : totalItems === 0 ? '暂无观看记录' : '当前页没有记录'}
        description={hasSearch ? '试试缩短关键词，或清除搜索条件。' : totalItems === 0 ? '更新番剧进度后，这里会生成可排序的记录表格。' : '请返回上一页后重试。'}
        surface="panel"
      />
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
            {entries.map(({ history: h, anime }) => (
              <tr
                key={h.id}
                className="border-b border-[var(--border-light)] hover:bg-[var(--tag-bg)]/50 transition-colors group"
              >
                {/* Date */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm text-[var(--text-primary)] font-mono">
                      {h.dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', timeZone: APP_TIME_ZONE })}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {h.dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: APP_TIME_ZONE })}
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
                      <ProgressBar
                        className="flex-1"
                        value={(h.episode / anime.totalEpisodes) * 100}
                        size="sm"
                        label={`${anime.title} 观看进度`}
                      />
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

      {totalPages > 1 ? (
        <div className="px-4 pb-4">
          <TimelinePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={onPageChange}
          />
        </div>
      ) : (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            共 {totalItems} 条记录
          </span>
        </div>
      )}
    </div>
  );
});
