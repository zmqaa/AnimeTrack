'use client';

import React from 'react';
import Link from 'next/link';
import { AnimeRecord } from '@/lib/dashboard-types';
import { formatPremiere } from '@/lib/formatters';

interface DashboardRightPanelProps {
  metadataCoverage: Array<{ label: string; percent: number }>;
  metadataRichness: number;
  tagBarData: Array<{ tag: string; count: number }>;
  tagBarMax: number;
  recentPremiered: AnimeRecord[];
}

export default React.memo(function DashboardRightPanel({
  metadataCoverage, metadataRichness, tagBarData, tagBarMax, recentPremiered,
}: DashboardRightPanelProps) {
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {/* Metadata Coverage */}
      <div className="glass-panel p-5 rounded-[28px] space-y-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)]">元数据完整度</h2>
        </div>
        <div className="space-y-2.5">
          {metadataCoverage.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] uppercase tracking-[0.22em]">{item.label}</span>
                <span className="text-[var(--text-muted)]">{item.percent}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div className="theme-accent-gradient h-full rounded-full" style={{ width: `${item.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="theme-accent-soft rounded-[18px] p-3">
          <div className="theme-accent-text-muted text-[10px]">完整度指数</div>
          <div className="theme-accent-text mt-1.5 text-xl font-mono">{metadataRichness}%</div>
          <p className="mt-1 text-xs text-[var(--text-secondary)] leading-5">具备 4 项以上核心字段的作品占比。值越高，图谱页和首页越完整。</p>
        </div>
      </div>

      {/* Tag Distribution */}
      <div className="glass-panel p-6 lg:p-7 rounded-[32px]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2 mb-5">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          观看统计与偏好
        </h2>
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">标签分布</h3>
            <span className="text-[10px] text-[var(--text-muted)]">条形图</span>
          </div>
          <div className="space-y-3">
            {tagBarData.map((item) => (
              <div key={`tag-${item.tag}`} className="rounded-xl px-2 py-1.5 transition-all duration-200 hover:scale-[1.01] hover:bg-[var(--color-surface-hover)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--text-secondary)] truncate">{item.tag}</span>
                  <span className="text-xs text-[var(--text-muted)] font-mono flex-shrink-0">{item.count} 部</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                  <div className="theme-accent-gradient h-full rounded-full transition-all duration-300" style={{ width: `${(item.count / tagBarMax) * 100}%` }} />
                </div>
              </div>
            ))}
            {!tagBarData.length && <div className="text-sm text-[var(--text-muted)]">标签数据还在累计中。</div>}
          </div>
        </div>
      </div>

      {/* Recent Premiered */}
      <div className="glass-panel p-7 rounded-[32px] flex-shrink-0">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2 mb-5">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          最近开播作品
        </h2>
        <div className="space-y-3">
          {recentPremiered.map((anime) => (
            <Link key={anime.id} href={`/anime/${anime.id}`}
              className="group surface-card-muted flex items-center justify-between gap-3 rounded-[20px] px-4 py-3 hover:border-[var(--color-airing)]/20 transition-all">
              <div className="min-w-0">
                <div className="text-sm text-[var(--text-primary)] truncate">{anime.title}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {formatPremiere(anime.premiereDate)} · {anime.totalEpisodes ? `${anime.totalEpisodes} 集` : '集数未补充'}
                </div>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] group-hover:text-[var(--color-airing)]">↗</span>
            </Link>
          ))}
          {!recentPremiered.length && <div className="text-sm text-[var(--text-muted)]">开播字段偏少，暂时没有可展示列表。</div>}
        </div>
      </div>
    </div>
  );
});
