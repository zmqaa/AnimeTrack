"use client";

import { CalendarDaysIcon, PlusIcon } from '@heroicons/react/24/outline';
import StatTile from '@/components/shared/StatTile';
import PageHero from '@/components/shared/PageHero';
import Link from 'next/link';

interface AnimeHeaderProps {
  showForm: boolean;
  editingId: number | null;
  setShowForm: (v: boolean) => void;
  resetForm: () => void;
  isAdmin?: boolean;
  totalCount: number;
  watchingCount: number;
  completedCount: number;
  loading?: boolean;
}

export default function AnimeHeader({
  showForm,
  editingId,
  setShowForm,
  resetForm,
  isAdmin = false,
  totalCount,
  watchingCount,
  completedCount,
  loading = false,
}: AnimeHeaderProps) {
  return (
    <PageHero
      className="glass-panel-strong"
      title="番剧列表"
      description="管理片库、更新观看进度，并快速找到想看的作品。"
      actions={(
        <>
          <Link
            href="/anime/timeline"
            className="surface-pill surface-hover flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
          >
            <CalendarDaysIcon className="w-4 h-4" />
            <span>追番时光机</span>
          </Link>
          {isAdmin && (
            <button
              onClick={() => { resetForm(); setShowForm(!showForm); }}
              className="theme-accent-button flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-theme-md transition"
            >
              <PlusIcon className="w-4 h-4" />
              <span>{showForm && !editingId ? '取消' : '手动添加'}</span>
            </button>
          )}
        </>
      )}
      statsClassName="grid min-w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[440px] lg:max-w-[480px]"
      stats={(
        <>
          <StatTile surface="card" label="片库作品" value={loading ? '—' : totalCount} unit="部" detail="当前收录总数" />
          <StatTile surface="card" label="正在追" value={loading ? '—' : watchingCount} unit="部" detail="仍在观看中" />
          <StatTile surface="card" label="已经看完" value={loading ? '—' : completedCount} unit="部" detail="完成观看的作品" />
        </>
      )}
    />
  );
}
