"use client";

import Image from 'next/image';
import { FireIcon, SparklesIcon, TagIcon, TvIcon } from '@heroicons/react/24/outline';
import type { AnimeCardItem, AnimeListItem } from '@/lib/anime-shared';
import { buildLibraryStats, formatRecentWatchDate } from './anime-page-helpers';

type AnimeSidebarProps = {
  items: AnimeListItem[];
  tagPreferences: Array<{ tag: string; count: number }>;
  tagFilter: string;
  recentWatchItems: AnimeListItem[];
  isAdmin: boolean;
  onToggleTagFilter: (tag: string) => void;
  onEdit: (item: AnimeCardItem) => void;
};

export default function AnimeSidebar({
  items,
  tagPreferences,
  tagFilter,
  recentWatchItems,
  isAdmin,
  onToggleTagFilter,
  onEdit,
}: AnimeSidebarProps) {
  const libraryStats = buildLibraryStats(items);

  return (
    <div className="lg:col-span-4 space-y-6 sticky top-8">
      <div className="surface-card rounded-2xl p-8 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <TvIcon className="w-20 h-20 text-[var(--text-primary)]" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-secondary)] mb-8 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse glow-watching"></span>
          库统计
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl border status-watching-soft hover:brightness-110 transition-all group/stat">
            <p className="text-xs text-[var(--color-watching)] font-bold uppercase mb-3 tracking-wider group-hover/stat:translate-x-1 transition-transform">还没看完</p>
            <div className="flex items-baseline gap-2">
              <p className="theme-stat-value text-3xl font-bold tracking-tighter leading-none">{libraryStats.unfinishedCount}</p>
              <p className="text-xs text-[var(--text-muted)] font-bold">部</p>
            </div>
          </div>
          <div className="status-completed-soft rounded-2xl border p-5 transition-all group/stat">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-completed)] transition-transform group-hover/stat:translate-x-1">已经看完</p>
            <div className="flex items-baseline gap-2">
              <p className="theme-stat-value text-3xl font-bold tracking-tighter leading-none">{libraryStats.completedCount}</p>
              <p className="text-xs text-[var(--text-muted)] font-bold">部</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[var(--border)] space-y-6">
          <div className="flex justify-between items-center group/info">
            <span className="text-sm font-medium text-[var(--text-muted)] group-hover/info:text-[var(--text-secondary)] transition-colors">累计观看剧集</span>
            <span className="theme-stat-value text-lg font-mono font-bold tracking-tight">
              {libraryStats.watchedEpisodes} <span className="text-[10px] text-[var(--text-muted)] ml-1 uppercase">Episodes</span>
            </span>
          </div>
          <div className="flex justify-between items-center group/info">
            <span className="text-sm font-medium text-[var(--text-muted)] group-hover/info:text-[var(--text-secondary)] transition-colors">累计时间估计</span>
            <span className="theme-stat-value text-lg font-mono font-bold tracking-tight">{libraryStats.totalHoursText}</span>
          </div>
        </div>
      </div>

      <div className="surface-card rounded-2xl p-8 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <TagIcon className="w-20 h-20 text-[var(--text-primary)]" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-secondary)] mb-8 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full status-plan-dot shadow-[0_0_10px_var(--color-plan-glow)]"></span>
          风格偏好
        </h3>
        <div className="flex flex-wrap gap-2.5 relative z-10">
          {tagPreferences.map(({ tag, count }) => {
            const isActive = tagFilter === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTagFilter(tag)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border transition-all group/tag ${
                  isActive
                    ? 'status-plan-soft'
                    : 'surface-pill hover:border-[var(--color-plan)]/30 hover:bg-[var(--color-plan)]/5'
                }`}
              >
                <span className={`text-xs font-medium transition-colors ${isActive ? 'text-[var(--color-plan)]' : 'text-[var(--text-secondary)] group-hover/tag:text-[var(--color-plan)]'}`}>{tag}</span>
                <span className={`text-[10px] font-mono ${isActive ? 'text-[var(--color-plan)]/80' : 'text-[var(--text-muted)] group-hover/tag:text-[var(--color-plan)]/50'}`}>{count}</span>
              </button>
            );
          })}
          {!tagPreferences.length && <div className="text-xs text-[var(--text-muted)]">标签还在累计中。</div>}
        </div>
      </div>

      <div className="surface-card rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <FireIcon className="w-16 h-16 text-[var(--text-primary)]" />
        </div>
        <h3 className="text-sm font-bold text-[var(--text-secondary)] mb-6 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-score)]"></span>
          最近观看
        </h3>
        <div className="space-y-3 relative z-10">
          {recentWatchItems.length > 0 ? recentWatchItems.map((item) => (
            <div
              key={item.id}
              onClick={() => isAdmin && onEdit(item)}
              className={`flex items-center gap-3 p-2.5 -mx-2 rounded-xl transition-all ${isAdmin ? 'cursor-pointer hover:bg-[var(--color-surface-hover)] hover:translate-x-1' : ''} group/item`}
            >
              <div className="surface-card-muted w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 group-hover/item:border-[var(--color-watching)]/30 transition-colors shadow-lg relative">
                {item.displayCoverUrl ? (
                  <Image src={item.displayCoverUrl} fill unoptimized sizes="40px" className="object-cover transition-transform group-hover/item:scale-110" alt="" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] text-[var(--text-muted)]">无封面</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate group-hover/item:text-[var(--color-watching)] transition-colors uppercase tracking-tight">{item.title}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                  <span className="font-medium">看到第 {item.progress} 集</span>
                  <span className="w-1 h-1 rounded-full bg-[var(--tag-bg)]"></span>
                  <span className="italic font-mono">{formatRecentWatchDate(item.lastWatchedAt)}</span>
                </div>
              </div>
              {isAdmin && (
                <div className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <div className="p-1 rounded-md bg-[var(--color-watching)]/10 text-[var(--color-watching)]">
                    <SparklesIcon className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>
          )) : (
            <div className="text-sm text-[var(--text-muted)]">暂无观看记录，先用&ldquo;看一集&rdquo;或 AI 录入补几条历史。</div>
          )}
        </div>
      </div>
    </div>
  );
}
