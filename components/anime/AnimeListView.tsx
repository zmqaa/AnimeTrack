"use client";

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckIcon, PlusIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import type { AnimeCardItem, AnimeStatus } from '@/lib/anime-shared';
import { statusLabels } from '@/lib/dashboard-types';
import ProgressBar from '@/components/shared/ProgressBar';

const statusDotClass: Record<AnimeStatus, string> = {
  watching: 'status-watching-dot',
  completed: 'status-completed-dot',
  dropped: 'status-dropped-dot',
  plan_to_watch: 'status-plan-dot',
};

interface AnimeListViewProps {
  items: AnimeCardItem[];
  onEdit: (item: AnimeCardItem) => void;
  updateProgress: (id: number, current: number, total?: number | null) => Promise<void>;
  isAdmin?: boolean;
  detailReturnTo: string;
  onOpenDetail: () => void;
}

export default memo(function AnimeListView({ items, onEdit, updateProgress, isAdmin = false, detailReturnTo, onOpenDetail }: AnimeListViewProps) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const isCompleted = item.status === 'completed';
        const progressPercent = item.totalEpisodes ? (item.progress / item.totalEpisodes) * 100 : 0;
        const detailHref = `/anime/${item.id}?returnTo=${encodeURIComponent(detailReturnTo)}`;

        return (
          <div
            key={item.id}
            className="group surface-card-muted flex items-center gap-4 p-3 rounded-2xl hover:border-[var(--border-light)] transition-all duration-200"
          >
            {/* 封面缩略图 */}
            <Link href={detailHref} onClick={onOpenDetail} className="flex-shrink-0 w-14 h-[74px] rounded-xl overflow-hidden bg-[var(--tag-bg)] relative">
              {item.displayCoverUrl ? (
                <Image
                  src={item.displayCoverUrl}
                  alt={item.title}
                  fill
                  unoptimized
                  sizes="56px"
                  className="object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    target.parentElement!.classList.add('anime-cover-fallback');
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center anime-cover-fallback">
                </div>
              )}
            </Link>

            {/* 标题与标签 */}
            <div className="flex-1 min-w-0 py-0.5">
              <Link href={detailHref} onClick={onOpenDetail} className="block">
                <h3 className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--color-completed)] transition-colors">
                  {item.title}
                </h3>
                {item.originalTitle && (
                  <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{item.originalTitle}</p>
                )}
              </Link>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass[item.status]}`} />
                <span className="text-[10px] text-[var(--text-muted)]">{statusLabels[item.status]}</span>
                {item.score != null && (
                  <span className="text-[10px] score-text font-mono">★ {item.score}</span>
                )}
                {item.durationMinutes && (
                  <span className="text-[10px] text-[var(--text-muted)]">{item.durationMinutes}m</span>
                )}
              </div>
            </div>

            {/* 进度 */}
            <div className="hidden sm:flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[120px]">
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                {item.progress} / {item.totalEpisodes || '?'}
              </span>
              <ProgressBar
                className="w-24"
                value={progressPercent || 0}
                size="sm"
                variant={isCompleted ? 'completed' : 'progress'}
                label={`${item.title} 观看进度`}
              />
            </div>

            {/* 操作按钮 */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => updateProgress(item.id, item.progress - 1, item.totalEpisodes)}
                  disabled={item.progress <= 0}
                  className="surface-pill p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition text-[10px] disabled:opacity-30"
                  aria-label="减一集"
                >
                  -1
                </button>
                {isCompleted ? (
                  <div className="p-1.5 rounded-lg success-soft border" aria-label="已完成">
                    <CheckIcon className="w-4 h-4" />
                  </div>
                ) : (
                  <button
                    onClick={() => updateProgress(item.id, item.progress + 1, item.totalEpisodes)}
                    className="p-1.5 rounded-lg bg-[var(--text-primary)] text-[var(--bg-page)] hover:opacity-90 transition"
                    aria-label="加一集"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onEdit(item)}
                  className="surface-pill p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition opacity-0 group-hover:opacity-100"
                  aria-label="编辑"
                >
                  <EllipsisHorizontalIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
