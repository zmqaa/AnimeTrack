"use client";

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckIcon, PlusIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import type { AnimeCardItem, AnimeStatus } from '@/lib/anime-shared';
import { statusLabels } from '@/lib/dashboard-types';

const statusSoftClass: Record<AnimeStatus, string> = {
  watching: 'status-watching-soft',
  completed: 'status-completed-soft',
  dropped: 'status-dropped-soft',
  plan_to_watch: 'status-plan-soft',
};

interface AnimeCardProps {
  item: AnimeCardItem;
  onEdit: (item: AnimeCardItem) => void;
  updateProgress: (id: number, current: number, total?: number | null) => Promise<void>;
  isAdmin?: boolean;
  detailReturnTo: string;
  onOpenDetail: () => void;
}

function resolveRewatchTag(tags?: string[]): string | undefined {
  if (!Array.isArray(tags) || tags.length === 0) {
    return undefined;
  }

  return tags
    .map((tag) => tag.trim())
    .find((tag) => /^([0-9]{1,3}|[一二两三四五六七八九十]+)刷$/i.test(tag));
}

export default memo(function AnimeCard({ item, onEdit, updateProgress, isAdmin = false, detailReturnTo, onOpenDetail }: AnimeCardProps) {
  const isCompleted = item.status === 'completed';
  const progressPercent = item.totalEpisodes
    ? (item.progress / item.totalEpisodes) * 100
    : isCompleted ? 100 : 0;
  const rewatchTag = resolveRewatchTag(item.tags);
  const detailHref = `/anime/${item.id}?returnTo=${encodeURIComponent(detailReturnTo)}`;

  return (
    <div className="group surface-card-muted theme-hover-elevated relative rounded-2xl overflow-hidden transition-all duration-300">
      {/* 封面部分 */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--tag-bg)]">
        <Link href={detailHref} className="block h-full" onClick={onOpenDetail}>
          {item.coverUrl ? (
            <Image
              src={item.coverUrl}
              alt={item.title}
              fill
              unoptimized
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110 opacity-70 group-hover:opacity-100"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                target.parentElement!.classList.add('anime-cover-fallback');
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--tag-bg)]">
              <span className="text-3xl mb-2 opacity-40">🎬</span>
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">No Cover</span>
            </div>
          )}
          <div className="absolute inset-0 cover-gradient-overlay opacity-60" />

          {/* 顶部标签 */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-md ${statusSoftClass[item.status]}`}>
              {statusLabels[item.status]}
            </span>
            {item.isFinished === false && item.status === 'watching' && (
              <span className="badge-airing-soft px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-md animate-pulse">
                  连载中
              </span>
            )}
            {item.isFinished === false && item.status !== 'watching' && (
              <span className="badge-airing-soft px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-md">
                  连载中
              </span>
            )}
            {item.isFinished === true && (
              <span className="badge-finished-soft px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-md">
                  已完结
              </span>
            )}
            {item.durationMinutes && (
                <span className="surface-pill px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-md">
                  {item.durationMinutes}m
              </span>
            )}
            {rewatchTag && (
              <span className="badge-rewatch-soft px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-md">
                  {rewatchTag}
              </span>
            )}
          </div>

          {/* 标题 & 底部遮罩 */}
          <div className="absolute bottom-3 left-3 right-3 truncate">
             <h3 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--color-plan)] transition-colors">{item.title}</h3>
             {item.originalTitle && <p className="text-[10px] text-[var(--text-muted)] truncate font-sans">{item.originalTitle}</p>}
          </div>
        </Link>

        {/* 快速编辑按钮 */}
        {isAdmin && (
          <button 
            onClick={() => onEdit(item)}
            className="surface-pill absolute top-2 right-2 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] opacity-0 group-hover:opacity-100 transition-all"
            aria-label="编辑"
          >
            <EllipsisHorizontalIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 详情部分 */}
      <div className="p-4 space-y-4">
        {/* 进度条 */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-medium">
            <span className="text-[var(--text-muted)]">剧集进度</span>
            <span className="text-[var(--text-secondary)]">{item.progress} / {item.totalEpisodes || '?'}</span>
          </div>
          <div className="h-1.5 w-full bg-[var(--tag-bg)] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${isCompleted ? 'progress-completed' : 'progress-gradient'}`}
              style={{ width: `${Math.min(progressPercent || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* 内容 */}
        {item.notes && (
          <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed h-8 italic">
            &ldquo;{item.notes}&rdquo;
          </p>
        )}

        {/* 交互按钮 */}
        {isAdmin && (
          <div className="flex items-center gap-2 pt-1">
            <button 
              onClick={() => updateProgress(item.id, item.progress - 1, item.totalEpisodes)}
              disabled={item.progress <= 0}
              className="surface-pill flex-1 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition text-[10px] disabled:opacity-30"
              aria-label="减一集"
            >
              -1
            </button>
            {isCompleted ? (
              <div className="flex-[2] py-1.5 rounded-lg success-soft text-[10px] font-medium text-center flex items-center justify-center gap-1 border">
                <CheckIcon className="w-3 h-3" /> 已看完
              </div>
            ) : (
               <button
                  onClick={() => updateProgress(item.id, item.progress + 1, item.totalEpisodes)}
                  className="theme-accent-button flex-[2] py-1.5 rounded-lg transition text-[10px] font-bold flex items-center justify-center gap-1 shadow-sm"
                  aria-label="看一集"
                >
                  <PlusIcon className="w-3 h-3" /> 看一集
                </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
