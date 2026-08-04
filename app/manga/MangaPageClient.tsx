'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import PageContainer from '@/components/shared/PageContainer';
import PageHero from '@/components/shared/PageHero';
import StatTile from '@/components/shared/StatTile';
import AsyncButton from '@/components/shared/AsyncButton';
import EmptyState from '@/components/shared/EmptyState';
import SegmentedControl from '@/components/shared/SegmentedControl';
import { fetchJson } from '@/lib/client-api';
import { useManageAccess } from '@/hooks/useManageAccess';
import {
  MANGA_PUBLICATION_STATUS_LABELS,
  MANGA_READING_STATUS_LABELS,
  type MangaReadingStatus,
  type MangaRecord,
} from '@/lib/manga-shared';

type MangaCandidate = {
  id: number;
  title: string;
  originalTitle?: string;
  aliases: string[];
  authors: string[];
  illustrators: string[];
  publishers: string[];
  serializations: string[];
  releaseDate?: string;
  startDate?: string;
  endDate?: string;
  volumeCount?: number;
  chapterCount?: number;
  isFinished?: boolean;
  coverUrl?: string;
  summary?: string;
  tags: string[];
};

type LookupResult = {
  input: string;
  selected: MangaCandidate | null;
  suggestion: MangaCandidate | null;
  needsConfirmation: boolean;
  reason: string;
  candidates: MangaCandidate[];
};

const readingStatusOptions: Array<{ value: '' | MangaReadingStatus; label: string }> = [
  { value: '', label: '全部' },
  ...Object.entries(MANGA_READING_STATUS_LABELS).map(([value, label]) => ({
    value: value as MangaReadingStatus,
    label,
  })),
];

const readingStatusSoftClass: Record<MangaReadingStatus, string> = {
  plan_to_read: 'status-plan-soft',
  reading: 'status-watching-soft',
  caught_up: 'badge-airing-soft',
  completed: 'status-completed-soft',
  paused: 'surface-pill',
  dropped: 'status-dropped-soft',
};

function formatPosition(record: MangaRecord) {
  const parts = [];
  if (record.currentVolume) parts.push(`第 ${record.currentVolume} 卷`);
  if (record.currentChapter) parts.push(`第 ${record.currentChapter} 话`);
  if (parts.length > 0) return `已读至${parts.join(' · ')}`;
  if (record.status === 'completed') return record.endDate ? `${record.endDate} 读完` : '已经读完';
  return '尚未记录阅读位置';
}

function candidateDescription(candidate: MangaCandidate) {
  return [
    candidate.authors.join('、') || candidate.illustrators.join('、'),
    candidate.volumeCount ? `${candidate.volumeCount} 卷` : '',
    candidate.chapterCount ? `${candidate.chapterCount} 话` : '',
    candidate.releaseDate?.slice(0, 4),
  ].filter(Boolean).join(' · ');
}

export default function MangaPageClient() {
  const { canManage } = useManageAccess();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | MangaReadingStatus>('');
  const [showAdd, setShowAdd] = useState(false);
  const [lookupTitle, setLookupTitle] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [addingId, setAddingId] = useState<number | 'manual' | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{ records: MangaRecord[]; total: number }>(
    '/api/manga',
    (url: string) => fetchJson<{ records: MangaRecord[]; total: number }>(url),
  );
  const records = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (data?.records || []).filter((item) => {
      if (status && item.status !== status) return false;
      if (!query) return true;
      return [item.title, item.originalTitle, ...item.aliases, ...item.authors, ...item.illustrators]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [data, search, status]);
  const allStats = useMemo(() => {
    const source = data?.records || [];
    return {
      total: data?.total || 0,
      reading: source.filter((item) => item.status === 'reading').length,
      caughtUp: source.filter((item) => item.status === 'caught_up').length,
      completed: source.filter((item) => item.status === 'completed').length,
    };
  }, [data]);

  const runLookup = async () => {
    const title = lookupTitle.trim();
    if (!title) return toast.error('请先输入漫画名称');
    setIsLookingUp(true);
    setLookup(null);
    try {
      const result = await fetchJson<{ results: LookupResult[] }>('/api/manga/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles: [title] }),
      }, '漫画资料查询失败');
      setLookup(result.results[0] || null);
    } catch (lookupError) {
      toast.error(lookupError instanceof Error ? lookupError.message : '漫画资料查询失败');
    } finally {
      setIsLookingUp(false);
    }
  };

  const addCandidate = async (candidate?: MangaCandidate) => {
    const marker = candidate?.id || 'manual';
    setAddingId(marker);
    try {
      await fetchJson<MangaRecord>('/api/manga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate ? {
          bangumiId: candidate.id,
          title: candidate.title,
          originalTitle: candidate.originalTitle,
          aliases: candidate.aliases,
          coverUrl: candidate.coverUrl,
          status: 'plan_to_read',
          publicationStatus: candidate.isFinished ? 'completed' : 'ongoing',
          totalVolumes: candidate.volumeCount,
          totalChapters: candidate.chapterCount,
          summary: candidate.summary,
          tags: candidate.tags,
          authors: candidate.authors,
          illustrators: candidate.illustrators,
          publishers: candidate.publishers,
          serializations: candidate.serializations,
          releaseDate: candidate.releaseDate,
        } : {
          title: lookupTitle.trim(),
          status: 'plan_to_read',
          publicationStatus: 'unknown',
        }),
      }, '添加漫画失败');
      toast.success(`已加入《${candidate?.title || lookupTitle.trim()}》`);
      setLookup(null);
      setLookupTitle('');
      await mutate();
    } catch (addError) {
      toast.error(addError instanceof Error ? addError.message : '添加漫画失败');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <PageContainer as="main" width="wide" spacing="roomy">
      <PageHero
        className="glass-panel-strong"
        title="漫画书架"
        description="记录想读、阅读中和已经读完的漫画；阅读位置不依赖固定总话数。"
        actions={(
          <div className="flex flex-wrap gap-2">
            <Link href="/anime" className="surface-pill surface-hover rounded-xl px-4 py-2.5 text-sm text-[var(--text-secondary)]">番剧</Link>
            <span className="theme-selected-pill rounded-xl px-4 py-2.5 text-sm font-medium">漫画</span>
            {canManage ? (
              <button type="button" onClick={() => setShowAdd((value) => !value)} className="theme-accent-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-theme-md">
                {showAdd ? <XMarkIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
                {showAdd ? '收起' : '添加漫画'}
              </button>
            ) : null}
          </div>
        )}
        stats={(
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile surface="card" label="书架" value={allStats.total} unit="部" />
            <StatTile surface="card" label="阅读中" value={allStats.reading} unit="部" />
            <StatTile surface="card" label="追到最新" value={allStats.caughtUp} unit="部" />
            <StatTile surface="card" label="已读完" value={allStats.completed} unit="部" />
          </div>
        )}
      />

      {showAdd && canManage ? (
        <section className="surface-card rounded-[28px] p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">漫画名称</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={lookupTitle}
                onChange={(event) => { setLookupTitle(event.target.value); setLookup(null); }}
                onKeyDown={(event) => { if (event.key === 'Enter') void runLookup(); }}
                placeholder="输入漫画名称，支持常见译名"
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] py-3 pl-12 pr-4 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <AsyncButton onClick={runLookup} busy={isLookingUp} busyLabel="正在查询…" className="theme-accent-soft rounded-2xl px-6 py-3 text-sm font-medium">
              查询资料
            </AsyncButton>
          </div>

          {lookup ? (
            <div className="mt-5 space-y-3">
              <div className="text-sm text-[var(--text-secondary)]">{lookup.reason}</div>
              {(lookup.selected ? [lookup.selected] : lookup.candidates.slice(0, 5)).map((candidate) => (
                <div key={candidate.id} className="surface-card-muted flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
                  <div className="h-24 w-16 shrink-0 rounded-xl bg-[var(--bg-card)] bg-cover bg-center" style={candidate.coverUrl ? { backgroundImage: `url(${candidate.coverUrl})` } : undefined} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--text-primary)]">{candidate.title}</div>
                    <div className="mt-1 truncate text-xs text-[var(--text-muted)]">{candidate.originalTitle || '未收录原名'}</div>
                    <div className="mt-2 text-sm text-[var(--text-secondary)]">{candidateDescription(candidate) || '资料较少，可进入详情后补充'}</div>
                  </div>
                  <AsyncButton onClick={() => addCandidate(candidate)} busy={addingId === candidate.id} busyLabel="添加中…" className="theme-accent-soft rounded-xl px-4 py-2 text-sm font-medium">
                    选择并加入
                  </AsyncButton>
                </div>
              ))}
              <AsyncButton onClick={() => addCandidate()} busy={addingId === 'manual'} busyLabel="添加中…" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)]">
                不关联候选，仅用“{lookupTitle.trim()}”添加
              </AsyncButton>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <label className="theme-focus-parent relative block shadow-sm">
          <MagnifyingGlassIcon className="theme-focus-icon pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)] transition-colors" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索漫画、原名、别名或作者…" className="surface-input theme-focus-accent w-full rounded-2xl py-3 pl-12 pr-4 text-sm text-[var(--text-primary)] outline-none shadow-xl" />
        </label>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedControl
            value={status}
            options={readingStatusOptions}
            onChange={setStatus}
            ariaLabel="漫画阅读状态筛选"
            className="max-w-full overflow-x-auto shadow-inner no-scrollbar"
            buttonClassName="px-4 py-1.5 text-sm font-medium"
            activeClassName="text-[var(--text-primary)]"
          />
          <div className="px-1 text-[10px] font-mono text-[var(--text-muted)]">SHOWING {records.length} TITLES</div>
        </div>
      </section>

      {error ? <div className="surface-card rounded-2xl p-6 text-[var(--color-danger)]">漫画列表加载失败，请稍后重试。</div> : null}
      {isLoading ? (
        <div className="py-16 text-center text-[var(--text-muted)]">正在整理漫画书架…</div>
      ) : records.length === 0 ? (
        <EmptyState
          title={search || status ? '没有符合条件的漫画' : '漫画书架还是空的'}
          description={canManage ? '可以从常用译名开始查询并加入第一部漫画。' : '管理员添加漫画后会显示在这里。'}
        />
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {records.map((record) => (
            <Link key={record.id} href={`/manga/${record.id}`} className="group surface-card-muted theme-hover-elevated overflow-hidden rounded-2xl transition-all duration-300">
              <div className="relative aspect-[3/4] overflow-hidden bg-[var(--tag-bg)]">
                {record.coverUrl ? (
                  <Image src={record.coverUrl} alt={record.title} fill unoptimized sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw" className="object-cover opacity-75 transition-all duration-500 group-hover:scale-110 group-hover:opacity-100" />
                ) : <div className="flex h-full items-center justify-center text-[var(--text-muted)]"><BookOpenIcon className="h-10 w-10" /></div>}
                <div className="cover-gradient-overlay absolute inset-0 opacity-60" />
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  <span className={`${readingStatusSoftClass[record.status]} rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-md`}>{MANGA_READING_STATUS_LABELS[record.status]}</span>
                  <span className={`${record.publicationStatus === 'completed' ? 'badge-finished-soft' : record.publicationStatus === 'ongoing' ? 'badge-airing-soft' : 'surface-pill'} rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-md`}>{MANGA_PUBLICATION_STATUS_LABELS[record.publicationStatus]}</span>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h2 className="truncate text-sm font-medium text-[var(--text-primary)] transition-colors group-hover:text-[var(--color-plan)]">{record.title}</h2>
                  <p className="truncate text-[10px] text-[var(--text-muted)]">{record.originalTitle || record.authors.join('、') || '资料待补充'}</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-[var(--text-muted)]">阅读位置</span>
                  <span className="truncate text-right font-medium text-[var(--text-secondary)]">{formatPosition(record)}</span>
                </div>
                {record.summary ? <p className="line-clamp-2 h-8 text-[11px] leading-relaxed text-[var(--text-muted)]">{record.summary}</p> : <p className="h-8 text-[11px] text-[var(--text-muted)]">{record.authors.join('、') || '作者资料待补充'}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
