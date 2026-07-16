'use client';

import React from 'react';
import { AnimeRecord } from '@/lib/dashboard-types';
import { formatPremiere } from '@/lib/formatters';
import SectionTitle from '@/components/shared/SectionTitle';
import ProgressBar from '@/components/shared/ProgressBar';
import CompactMediaItem from '@/components/shared/CompactMediaItem';
import EmptyState from '@/components/shared/EmptyState';

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
        <SectionTitle>元数据完整度</SectionTitle>
        <div className="space-y-2.5">
          {metadataCoverage.map((item) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] uppercase tracking-[0.22em]">{item.label}</span>
                <span className="text-[var(--text-muted)]">{item.percent}%</span>
              </div>
              <ProgressBar value={item.percent} variant="accent" size="sm" label={`${item.label} 完整度`} />
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
        <SectionTitle className="mb-5">观看统计与偏好</SectionTitle>
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
                <ProgressBar
                  className="mt-1.5"
                  value={(item.count / tagBarMax) * 100}
                  variant="accent"
                  size="sm"
                  label={`${item.tag} 标签占比`}
                />
              </div>
            ))}
            {!tagBarData.length && <div className="text-sm text-[var(--text-muted)]">标签数据还在累计中。</div>}
          </div>
        </div>
      </div>

      {/* Recent Premiered */}
      <div className="glass-panel p-7 rounded-[32px] flex-shrink-0">
        <SectionTitle className="mb-5">最近开播作品</SectionTitle>
        <div className="space-y-3">
          {recentPremiered.map((anime) => (
            <CompactMediaItem
              key={anime.id}
              href={`/anime/${anime.id}`}
              title={anime.title}
              description={`${formatPremiere(anime.premiereDate)} · ${anime.totalEpisodes ? `${anime.totalEpisodes} 集` : '集数未补充'}`}
            />
          ))}
          {!recentPremiered.length && (
            <EmptyState
              title="暂无开播作品"
              description="补充作品的开播日期后，这里会显示最近开播列表。"
              size="compact"
            />
          )}
        </div>
      </div>
    </div>
  );
});
