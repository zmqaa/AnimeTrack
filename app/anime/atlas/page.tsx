"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import { useAnimeData } from '@/hooks/useAnimeData';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getAppThemeDefinition } from '@/lib/theme';
import { YearBarChart } from '@/components/dashboard/YearBarChart';
import { ChordDiagram } from '@/components/dashboard/ChordDiagram';
import { CastNetwork } from '@/components/dashboard/CastNetwork';
import { ANIME_STATUS_LABELS } from '@/lib/anime-shared';
import StatTile from '@/components/shared/StatTile';
import SectionTitle from '@/components/shared/SectionTitle';
import PageHero from '@/components/shared/PageHero';
import Panel from '@/components/shared/Panel';
import { CompactListSkeleton, ContentSkeleton } from '@/components/shared/Skeleton';
import PageContainer from '@/components/shared/PageContainer';
import CompactMediaItem from '@/components/shared/CompactMediaItem';
import EmptyState from '@/components/shared/EmptyState';

function formatStartDate(value?: string) {
  if (!value) return '未补充';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export default function AnimeAtlasPage() {
  const { animeList, isLoading: animeLoading } = useAnimeData();
  const { theme } = useTheme();
  const themeDef = getAppThemeDefinition(theme);

  const data = useMemo(() => {
    const castCounts: Record<string, number> = {};

    animeList.forEach((anime) => {
      if (Array.isArray(anime.cast)) {
        anime.cast.forEach((name) => {
          const normalized = String(name || '').trim();
          if (!normalized) return;
          castCounts[normalized] = (castCounts[normalized] || 0) + 1;
        });
      }
    });

    const scored = animeList
      .filter((anime) => typeof anime.score === 'number')
      .sort((left, right) => {
        const scoreDiff = (right.score ?? 0) - (left.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return left.title.localeCompare(right.title, 'zh-CN');
      })
      .slice(0, 9);

    const recentlyStarted = animeList
      .filter((anime) => anime.startDate)
      .sort((left, right) => new Date(right.startDate ?? 0).getTime() - new Date(left.startDate ?? 0).getTime())
      .slice(0, 6);

    // 标签出现次数排行
    const tagCountMap: Record<string, number> = {};
    animeList.forEach((anime) => {
      if (!Array.isArray(anime.tags)) return;
      anime.tags.forEach((tag) => {
        const t = String(tag || '').trim();
        if (!t) return;
        tagCountMap[t] = (tagCountMap[t] || 0) + 1;
      });
    });
    const tagRanking = Object.entries(tagCountMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const metadataRichness = animeList.length
      ? Math.round(
          (animeList.filter((anime) => [anime.originalTitle, anime.score, anime.totalEpisodes, Array.isArray(anime.cast) && anime.cast.length > 0 ? 'cast' : '', anime.premiereDate, anime.summary].filter(Boolean).length >= 4).length /
            animeList.length) *
            100
        )
      : 0;

    // ── 和弦图数据：声优 × 标签交叉统计 ──
    const allCast = Object.entries(castCounts).sort((a, b) => b[1] - a[1]);
    const allTags = Object.entries(tagCountMap).sort((a, b) => b[1] - a[1]);

    function buildChordData(castList: [string, number][], tagList: [string, number][]) {
      const matrix: Record<string, Record<string, number>> = {};
      castList.forEach(([name]) => { matrix[name] = {}; });

      animeList.forEach((anime) => {
        if (!Array.isArray(anime.cast) || !Array.isArray(anime.tags)) return;
        const animeTags = new Set(anime.tags.map((t: string) => String(t || '').trim()).filter(Boolean));
        const castInAnime = anime.cast
          .map((c: string) => String(c || '').trim())
          .filter((c: string) => c && matrix[c]);
        castInAnime.forEach((cast: string) => {
          tagList.forEach(([tag]) => {
            if (animeTags.has(tag)) matrix[cast][tag] = (matrix[cast][tag] || 0) + 1;
          });
        });
      });

      const nodes = [
        ...castList.map(([name, count]) => ({ id: name, label: name, group: 'cast' as const, value: count })),
        ...tagList.map(([tag, count]) => ({ id: tag, label: tag, group: 'tag' as const, value: count })),
      ];
      const links: { source: string; target: string; value: number }[] = [];
      castList.forEach(([cast]) => {
        tagList.forEach(([tag]) => {
          const w = matrix[cast]?.[tag] ?? 0;
          if (w > 0) links.push({ source: cast, target: tag, value: w });
        });
      });
      return { nodes, links, hasData: links.length >= 3 };
    }

    const leftChord = buildChordData(allCast.slice(0, 12), allTags.slice(0, 8));
    const rightChord = buildChordData(allCast.slice(12, 24), allTags.slice(0, 8));

    // ── 声优共演网络数据 ──
    const topNetworkCast = allCast.slice(0, 20);
    const networkCastSet = new Set(topNetworkCast.map(([n]) => n));

    // 构建共现矩阵：两两声优共同出演计数
    const cooccurrence: Record<string, Record<string, number>> = {};
    topNetworkCast.forEach(([name]) => { cooccurrence[name] = {}; });

    animeList.forEach((anime) => {
      if (!Array.isArray(anime.cast)) return;
      const castInAnime = anime.cast
        .map((c: string) => String(c || '').trim())
        .filter((c: string) => networkCastSet.has(c));
      for (let i = 0; i < castInAnime.length; i++) {
        for (let j = i + 1; j < castInAnime.length; j++) {
          const a = castInAnime[i];
          const b = castInAnime[j];
          if (!cooccurrence[a]) cooccurrence[a] = {};
          cooccurrence[a][b] = (cooccurrence[a][b] || 0) + 1;
        }
      }
    });

    const networkNodes = topNetworkCast.map(([name, count]) => ({
      id: name, label: name, value: count,
    }));

    const networkLinks: { source: string; target: string; value: number }[] = [];
    topNetworkCast.forEach(([a]) => {
      topNetworkCast.forEach(([b]) => {
        if (a >= b) return; // upper triangle only
        // 数据可能存 a→b 或 b→a，取决于每部番的 cast 顺序，两边都要查
        const w = (cooccurrence[a]?.[b] ?? 0) + (cooccurrence[b]?.[a] ?? 0);
        if (w >= 2) networkLinks.push({ source: a, target: b, value: w });
      });
    });

    // filter orphan nodes
    const linkedIds = new Set<string>();
    networkLinks.forEach((l) => { linkedIds.add(l.source); linkedIds.add(l.target); });
    const filteredNetworkNodes = networkNodes.filter((n) => linkedIds.has(n.id));
    const hasNetworkData = filteredNetworkNodes.length >= 3 && networkLinks.length >= 2;

    return {
      scored,
      recentlyStarted,
      tagRanking,
      metadataRichness,
      leftChord,
      rightChord,
      networkNodes: filteredNetworkNodes,
      networkLinks,
      hasNetworkData,
    };
  }, [animeList]);

  const loading = animeLoading;

  return (
    <PageContainer as="main" width="wide" spacing="default">
      <div className="theme-atlas-aura absolute inset-0 pointer-events-none opacity-40" />

      <PageHero
        className="glass-panel-strong"
        spacing="roomy"
        title="作品元数据图谱"
        description="这里专门展示你的片库中标签分布、声优×标签关联图谱、作品评分和最近开始追的作品。"
        backHref="/"
        backLabel="返回总览"
        backdrop={<div className="theme-atlas-hero-aura absolute inset-0" />}
        statsClassName="grid min-w-full grid-cols-2 gap-3 lg:min-w-[320px] lg:max-w-[360px]"
        stats={(
          <>
            <StatTile surface="card" label="入库作品" value={animeList.length} unit="部" detail="当前片库收录总数" />
            <StatTile surface="card" label="档案完整度" value={`${data.metadataRichness}%`} detail="元数据填写覆盖率" />
          </>
        )}
      />

      {data.tagRanking.length > 0 && (
        <Panel title="标签排行 Top 10" size="large" className="relative z-10">
          <YearBarChart
            data={data.tagRanking.map((item, i) => ({
              label: item.tag,
              value: item.count,
              color: themeDef.premierePalette[i % themeDef.premierePalette.length],
            }))}
            height={240}
            sortBy="value"
            labelFontSize={12}
          />
        </Panel>
      )}

      {/* ── 声优 × 标签 和弦图 双列 ── */}
      {(data.leftChord.hasData || data.rightChord.hasData) && (
        <section className="glass-panel rounded-[32px] p-6 lg:p-8 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <SectionTitle>声优 × 标签 关联图谱</SectionTitle>
            <span className="text-[10px] text-[var(--text-muted)] ml-auto">悬停查看关联</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.leftChord.hasData && (
              <div>
                <div className="text-xs text-[var(--text-muted)] text-center mb-1">声优视角 · Top 1–12 声优 × 8 标签</div>
                <ChordDiagram nodes={data.leftChord.nodes} links={data.leftChord.links} />
              </div>
            )}
            {data.rightChord.hasData && (
              <div>
                <div className="text-xs text-[var(--text-muted)] text-center mb-1">声优视角 · Top 13–24 声优 × 8 标签</div>
                <ChordDiagram nodes={data.rightChord.nodes} links={data.rightChord.links} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 声优共演网络 ── */}
      {data.hasNetworkData && (
        <section className="glass-panel rounded-[32px] p-6 lg:p-8 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <SectionTitle>声优共演网络</SectionTitle>
            <span className="text-[10px] text-[var(--text-muted)] ml-auto">拖拽节点 · 悬停高亮</span>
          </div>
          <CastNetwork nodes={data.networkNodes} links={data.networkLinks} height={500} />
        </section>
      )}

      {loading ? (
        <div className="relative z-10 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel size="large">
            <ContentSkeleton lines={5} />
          </Panel>
          <Panel size="large">
            <CompactListSkeleton count={5} />
          </Panel>
        </div>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative z-10">
          <Panel title="作品评分" size="large" className="xl:col-span-7">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.scored.map((anime, index) => (
                <Link key={anime.id} href={`/anime/${anime.id}`} className="group surface-card-muted rounded-[28px] overflow-hidden hover:border-[var(--color-score)]/20 transition-all duration-300">
                  <div className="h-40 bg-[var(--bg-card)] bg-cover bg-center" style={anime.displayCoverUrl ? { backgroundImage: `linear-gradient(180deg, var(--color-cover-gradient-start), var(--color-cover-gradient-end)), url(${anime.displayCoverUrl})` } : undefined} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Rank #{index + 1}</div>
                        <div className="mt-1 text-lg text-[var(--text-primary)] truncate">{anime.title}</div>
                        <div className="text-xs text-[var(--text-muted)] truncate">{anime.originalTitle ?? '未补充原名'}</div>
                      </div>
                      <div className="shrink-0 rounded-full border score-soft px-2.5 py-1 text-sm">
                        {anime.score?.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {!data.scored.length && (
                <div className="md:col-span-2 xl:col-span-3">
                  <EmptyState
                    title="暂无评分作品"
                    description="为作品补充评分后，这里会自动生成评分排行。"
                    size="compact"
                  />
                </div>
              )}
            </div>
          </Panel>

          <div className="xl:col-span-5 space-y-6">
            <Panel title="最近开始追的作品" size="large">
              <div className="space-y-3">
                {data.recentlyStarted.map((anime) => (
                  <CompactMediaItem
                    key={anime.id}
                    href={`/anime/${anime.id}`}
                    title={anime.title}
                    description={`${formatStartDate(anime.startDate)}开始 · ${anime.totalEpisodes ? `${anime.progress} / ${anime.totalEpisodes} 集` : ANIME_STATUS_LABELS[anime.status]}`}
                  />
                ))}
                {!data.recentlyStarted.length && (
                  <EmptyState
                    title="暂无开始追番记录"
                    description="补充开始观看日期后，最近开始追的作品会显示在这里。"
                    size="compact"
                  />
                )}
              </div>
            </Panel>
          </div>
        </section>
      )}
    </PageContainer>
  );
}
