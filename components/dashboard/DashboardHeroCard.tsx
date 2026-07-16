'use client';

import React, { useEffect, useState } from 'react';
import { AnimeRecord } from '@/lib/dashboard-types';
import { formatDate, formatPremiere, formatTime, formatUpdateDate } from '@/lib/formatters';
import StatTile from '@/components/shared/StatTile';

interface HeroCardProps {
  animeStats: { count: number };
  animeCompletionRate: number;
  weeklyEpisodes: number;
  watchHours: number;
  heroAnime: AnimeRecord | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export default React.memo(function DashboardHeroCard({
  animeStats, animeCompletionRate,
  weeklyEpisodes, watchHours, heroAnime,
  isLoading, isRefreshing,
}: HeroCardProps) {
  const [nowText, setNowText] = useState<{ time: string; date: string } | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setNowText({ time: formatTime(now), date: formatDate(now) });
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const heroStyle = heroAnime?.coverUrl
    ? {
        backgroundImage: `var(--hero-overlay), url(${heroAnime.coverUrl})`,
        backgroundSize: 'cover' as const,
        backgroundPosition: 'center' as const,
      }
    : undefined;

  return (
    <section className="glass-panel-strong rounded-[36px] p-7 lg:p-10 relative overflow-hidden">
      {heroStyle && <div className="absolute inset-0 opacity-60" style={heroStyle} />}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-surface-raised),transparent_42%)]" />

      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
        <div className="xl:col-span-7 flex flex-col justify-between gap-8">
          <div>
            <div className="mb-3 flex min-h-5 flex-wrap items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
              <span>{nowText ? `${nowText.date} · ${nowText.time}` : ''}</span>
              {(isLoading || isRefreshing) && (
                <span className="badge-airing-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-watching)] animate-pulse" />
                  {isLoading ? '初始化数据中...' : '数据同步中...'}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
              动漫记录总览
            </h1>
            <span className="block text-[var(--text-secondary)] text-base md:text-xl mt-3 font-normal">
              记录、评分和元数据，全都在这里。
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 md:grid-cols-4">
            <StatTile label="番剧总数" value={animeStats.count} unit="部" />
            <StatTile label="完结率" value={`${animeCompletionRate}%`} />
            <StatTile label="本周观看" value={weeklyEpisodes} unit="集" />
            <StatTile label="看番总时长" value={watchHours} unit="小时" />
          </div>
        </div>

        <div className="xl:col-span-5 surface-card rounded-[30px] p-5 lg:p-6 backdrop-blur-md">
          <div className="text-[10px] text-[var(--text-muted)]">最近在看</div>
          {heroAnime ? (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-2xl font-display text-[var(--text-primary)] leading-snug">{heroAnime.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1 truncate">{heroAnime.originalTitle ?? '尚未补充原名'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="评分" value={typeof heroAnime.score === 'number' ? heroAnime.score.toFixed(1) : '未补充'} size="compact" />
                <StatTile label="首播" value={formatPremiere(heroAnime.premiereDate)} size="compact" />
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
