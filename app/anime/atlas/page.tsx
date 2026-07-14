"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import {
  ArrowUpRightIcon,
  ChevronLeftIcon,
} from '@heroicons/react/24/outline';
import { useAnimeData } from '@/hooks/useAnimeData';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getAppThemeDefinition } from '@/lib/theme';
import { YearBarChart } from '@/components/dashboard/YearBarChart';
import { ChordDiagram } from '@/components/dashboard/ChordDiagram';
import { CastNetwork } from '@/components/dashboard/CastNetwork';
function formatPremiere(value?: string) {
  if (!value) return '未补充';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short' }).format(date);
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

    const premiered = animeList
      .filter((anime) => anime.premiereDate)
      .sort((left, right) => new Date(right.premiereDate ?? 0).getTime() - new Date(left.premiereDate ?? 0).getTime())
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

      const tagSet = new Set(tagList.map(([t]) => t));
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
      premiered,
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
    <main className="p-4 lg:p-8 pb-24 space-y-6 lg:space-y-8 animate-fade-in relative">
      <div className="theme-atlas-aura absolute inset-0 pointer-events-none opacity-40" />

      <section className="glass-panel-strong rounded-[36px] p-8 lg:p-10 relative overflow-hidden">
        <div className="theme-atlas-hero-aura absolute inset-0" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4 max-w-3xl">
            <Link href="/" className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors">
              <ChevronLeftIcon className="w-4 h-4" /> 返回总览
            </Link>
            <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-[var(--text-primary)]">作品元数据图谱</h1>
            <p className="text-sm md:text-base text-[var(--text-secondary)] leading-7">
              这里专门展示你的片库中标签分布、声优×标签关联图谱、作品评分和最近开播作品。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-full lg:min-w-[320px] lg:max-w-[360px]">
            <div className="surface-card rounded-[24px] p-4">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">Library</div>
              <div className="mt-2 text-2xl font-mono text-[var(--text-primary)]">{animeList.length}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">当前入库作品</div>
            </div>
            <div className="surface-card rounded-[24px] p-4">
              <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--text-muted)]">Richness</div>
              <div className="theme-accent-text mt-2 text-2xl font-mono">{data.metadataRichness}%</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">档案完整度</div>
            </div>
          </div>
        </div>
      </section>

      {data.tagRanking.length > 0 && (
        <section className="glass-panel rounded-[32px] p-6 lg:p-8 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, var(--chart-line-start), var(--chart-line-end))' }} />
            <h2 className="text-xl font-display font-semibold text-[var(--text-primary)]">标签排行 Top 10</h2>
          </div>
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
        </section>
      )}

      {/* ── 声优 × 标签 和弦图 双列 ── */}
      {(data.leftChord.hasData || data.rightChord.hasData) && (
        <section className="glass-panel rounded-[32px] p-6 lg:p-8 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, var(--chart-line-start), var(--chart-line-end))' }} />
            <h2 className="text-xl font-display font-semibold text-[var(--text-primary)]">声优 × 标签 关联图谱</h2>
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
            <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, var(--chart-line-start), var(--chart-line-end))' }} />
            <h2 className="text-xl font-display font-semibold text-[var(--text-primary)]">声优共演网络</h2>
            <span className="text-[10px] text-[var(--text-muted)] ml-auto">拖拽节点 · 悬停高亮</span>
          </div>
          <CastNetwork nodes={data.networkNodes} links={data.networkLinks} height={500} />
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative z-10">
        <div className="xl:col-span-7 glass-panel rounded-[32px] p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, var(--chart-line-start), var(--chart-line-end))' }} />
            <h2 className="text-xl font-display font-semibold text-[var(--text-primary)]">作品评分</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.scored.map((anime, index) => (
              <Link key={anime.id} href={`/anime/${anime.id}`} className="group surface-card-muted rounded-[28px] overflow-hidden hover:border-[var(--color-score)]/20 transition-all duration-300">
                <div className="h-40 bg-[var(--bg-card)] bg-cover bg-center" style={anime.coverUrl ? { backgroundImage: `linear-gradient(180deg, var(--color-cover-gradient-start), var(--color-cover-gradient-end)), url(${anime.coverUrl})` } : undefined} />
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
            {!data.scored.length && <div className="text-sm text-[var(--text-muted)]">评分字段还不够丰富，之后可以继续补齐。</div>}
          </div>
        </div>

        <div className="xl:col-span-5 space-y-6">
          <div className="glass-panel rounded-[32px] p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(to bottom, var(--chart-line-start), var(--chart-line-end))' }} />
              <h2 className="text-xl font-display font-semibold text-[var(--text-primary)]">追番列表中最近开播作品</h2>
            </div>
            <div className="space-y-3">
              {data.premiered.map((anime) => (
                <Link key={anime.id} href={`/anime/${anime.id}`} className="group surface-card-muted flex items-center justify-between gap-3 rounded-[20px] px-4 py-3 hover:border-[var(--color-airing)]/20 transition-all">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--text-primary)] truncate">{anime.title}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{formatPremiere(anime.premiereDate)} · {anime.totalEpisodes ? `${anime.totalEpisodes} 集` : '集数未补充'}</div>
                  </div>
                  <ArrowUpRightIcon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-airing transition-colors" />
                </Link>
              ))}
              {!data.premiered.length && <div className="text-sm text-[var(--text-muted)]">首播日期字段暂时较少。</div>}
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="text-sm text-[var(--text-muted)] font-mono px-2">ATLAS_LOADING...</div>
      )}
    </main>
  );
}