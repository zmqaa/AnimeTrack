"use client";

import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Bars3Icon,
  CheckIcon,
  ChevronDownIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import SegmentedControl from '@/components/shared/SegmentedControl';

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
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const selectedSort = SORT_OPTIONS.find((option) => option.value === sortBy) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!sortOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) setSortOpen(false);
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSortOpen(false);
        sortTriggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [sortOpen]);

  const focusSortOption = (position: 'selected' | 'first' | 'last') => {
    requestAnimationFrame(() => {
      const options = Array.from(sortMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
      if (!options.length) return;
      const target = position === 'first'
        ? options[0]
        : position === 'last'
          ? options[options.length - 1]
          : options.find((option) => option.dataset.value === sortBy) ?? options[0];
      target.focus();
    });
  };

  const handleSortTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setSortOpen(true);
      focusSortOption(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const handleSortOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(sortMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const currentIndex = options.indexOf(event.currentTarget);
    if (event.key === 'Home') options[0]?.focus();
    else if (event.key === 'End') options[options.length - 1]?.focus();
    else {
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      options[(currentIndex + offset + options.length) % options.length]?.focus();
    }
  };

  return (
    <div className="glass-panel rounded-[28px] p-4 md:p-5 flex flex-col gap-4">
      {/* View mode tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={viewMode}
          options={VIEW_OPTIONS.map(({ mode, ...option }) => ({ value: mode, ...option }))}
          onChange={onViewModeChange}
          ariaLabel="记录展示方式"
        />

        {/* Group by (only relevant for timeline view) */}
        {viewMode === 'timeline' && (
          <SegmentedControl
            value={groupBy}
            options={GROUP_OPTIONS}
            onChange={onGroupByChange}
            ariaLabel="时间线分组方式"
            buttonClassName="px-3 py-1.5 text-xs font-bold uppercase"
          />
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
        <div ref={sortMenuRef} className="relative">
          <button
            ref={sortTriggerRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((open) => !open)}
            onKeyDown={handleSortTriggerKeyDown}
            className="surface-input flex min-w-[112px] items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider outline-none transition-all hover:border-[var(--border-light)] focus:ring-2 focus:ring-primary/30"
          >
            <span>{selectedSort.label}</span>
            <ChevronDownIcon className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
          </button>

          {sortOpen && (
            <div
              role="listbox"
              aria-label="记录排序方式"
              className="surface-pill shadow-theme-lg absolute right-0 top-full z-30 mt-2 min-w-[148px] rounded-2xl p-1.5"
            >
              {SORT_OPTIONS.map(({ value, label }) => {
                const selected = value === sortBy;
                return (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-value={value}
                    onKeyDown={handleSortOptionKeyDown}
                    onClick={() => {
                      onSortByChange(value);
                      setSortOpen(false);
                      sortTriggerRef.current?.focus();
                    }}
                    style={selected ? { backgroundColor: 'var(--color-surface-hover)' } : undefined}
                    className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      selected
                        ? 'text-primary'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{label}</span>
                    <CheckIcon className={`h-3.5 w-3.5 ${selected ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
