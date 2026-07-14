'use client';

import React from 'react';
import { AnimeRecord } from '@/lib/dashboard-types';
import { formatPremiere, formatUpdateDate } from '@/lib/formatters';
import type { AppThemeDefinition } from '@/lib/theme';

interface HeroCardProps {
  animeStats: { count: number };
  metadataRichness: number;
  animeCompletionRate: number;
  weeklyEpisodes: number;
  heroAnime: AnimeRecord | null;
  themeDefinition: AppThemeDefinition;
}

export default React.memo(function DashboardHeroCard({
  animeStats, metadataRichness, animeCompletionRate,
  weeklyEpisodes, heroAnime, themeDefinition,
}: HeroCardProps) {
  const heroStyle = heroAnime?.coverUrl
    ? {
        backgroundImage: `${themeDefinition.heroOverlay}, url(${heroAnime.coverUrl})`,
        backgroundSize: 'cover' as const,
        backgroundPosition: 'center' as const,
      }
    : undefined;

  return (
    <section className="glass-panel-strong rounded-[36px] p-7 lg:p-10 relative overflow-hidden">
      {heroStyle && <div className="absolute inset-0 opacity-60" style={heroStyle} />}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-surface-raised),transparent_42%)]" />

      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
        <div className="xl:col-span-8 space-y-5">
          <h2 className="text-2xl md:text-4xl font-display font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
            我的番剧
            <span className="block text-[var(--text-secondary)] text-base md:text-xl mt-3 font-normal">
              记录、评分和元数据，全都在这里。
            </span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="surface-card rounded-[20px] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--text-muted)]">馆藏总量</div>
              <div className="mt-1 text-2xl font-mono text-[var(--text-primary)]">{animeStats.count}</div>
            </div>
            <div className="surface-card rounded-[20px] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--text-muted)]">档案完整度</div>
              <div className="theme-accent-text mt-1 text-2xl font-mono">{metadataRichness}%</div>
            </div>
            <div className="surface-card rounded-[20px] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--text-muted)]">完结率</div>
              <div className="theme-secondary-text mt-1 text-2xl font-mono">{animeCompletionRate}%</div>
            </div>
            <div className="surface-card rounded-[20px] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--text-muted)]">本周观看</div>
              <div className="mt-1 text-2xl font-mono score-text">{weeklyEpisodes} 集</div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 surface-card rounded-[30px] p-5 lg:p-6 backdrop-blur-md">
          <div className="text-[10px] text-[var(--text-muted)]">最近在看</div>
          {heroAnime ? (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-2xl font-display text-[var(--text-primary)] leading-snug">{heroAnime.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1 truncate">{heroAnime.originalTitle ?? '尚未补充原名'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="surface-card-muted rounded-2xl p-3">
                  <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--text-muted)]">评分</div>
                  <div className="mt-1 text-xl score-text font-mono">
                    {typeof heroAnime.score === 'number' ? heroAnime.score.toFixed(1) : '未补充'}
                  </div>
                </div>
                <div className="surface-card-muted rounded-2xl p-3">
                  <div className="text-[10px] uppercase tracking-[0.26em] text-[var(--text-muted)]">首播</div>
                  <div className="mt-1 text-xl text-airing font-mono">{formatPremiere(heroAnime.premiereDate)}</div>
                </div>
              </div>
              <div className="text-xs text-[var(--text-secondary)] leading-6 line-clamp-3">
                {heroAnime.summary ?? '这部作品还没有补充摘要。可以在详情页使用 AI 补充，首页会自动展示更丰富信息。'}
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>最近编辑</span>
                <span>{formatUpdateDate(heroAnime.updatedAt)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-[var(--text-muted)]">暂无作品数据，先去片库添加第一部番剧吧。</div>
          )}
        </div>
      </div>
    </section>
  );
});
