"use client";

import { memo } from 'react';
import {
  Bars3Icon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export type TimelineViewMode = 'timeline' | 'table';
export type TimelineSortBy = 'newest' | 'oldest' | 'mostEpisodes';

interface TimelineControlsProps {
  viewMode: TimelineViewMode;
  onViewModeChange: (mode: TimelineViewMode) => void;
  sortBy: TimelineSortBy;
  onSortByChange: (sort: TimelineSortBy) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  groupBy: 'day' | 'week' | 'month';
  onGroupByChange: (group: 'day' | 'week' | 'month') => void;
}

const VIEW_OPTIONS: { mode: TimelineViewMode; label: string; icon: typeof Bars3Icon }[] = [
  { mode: 'timeline', label: '时间线', icon: Bars3Icon },
  { mode: 'table', label: '列表', icon: ListBulletIcon },
];

const SORT_OPTIONS: { value: TimelineSortBy; label: string }[] = [
  { value: 'newest', label: '最新优先' },
  { value: 'oldest', label: '最早优先' },
  { value: 'mostEpisodes', label: '集数最多' },
];

const GROUP_OPTIONS: { value: 'day' | 'week' | 'month'; label: string }[] = [
  { value: 'day', label: '按天' },
  { value: 'week', label: '按周' },
  { value: 'month', label: '按月' },
];

export default memo(function TimelineControls({
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  searchQuery,
  onSearchChange,
  groupBy,
  onGroupByChange,
}: TimelineControlsProps) {
  return (
    <div className="glass-panel rounded-[28px] p-4 md:p-5 flex flex-col gap-4">
      {/* View mode tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="surface-card-muted flex p-1 rounded-xl">
          {VIEW_OPTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                viewMode === mode
                  ? 'bg-[var(--tag-bg)] text-primary shadow-sm ring-1 ring-[var(--border)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Group by (only relevant for timeline view) */}
        {viewMode === 'timeline' && (
          <div className="surface-card-muted flex p-1 rounded-xl">
            {GROUP_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onGroupByChange(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  groupBy === value
                    ? 'bg-[var(--tag-bg)] text-primary shadow-sm ring-1 ring-[var(--border)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative min-w-[180px] max-w-[260px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索番剧..."
            className="surface-input w-full pl-9 pr-8 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as TimelineSortBy)}
          className="surface-input rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none cursor-pointer"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
});
