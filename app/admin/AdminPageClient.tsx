"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SegmentedControl from '@/components/shared/SegmentedControl';
import { fetchJson } from '@/lib/client-api';
import { useRuntimeAccess } from '@/hooks/useRuntimeAccess';
import { adminAnimeKey, adminHistoryKey, ANIME_LIST_KEY, HISTORY_KEY, swrFetcher } from '@/lib/swr-config';
import {
  Checkbox,
  DeleteButton,
  Pagination,
  SearchBar,
  SkeletonRows,
  useDebouncedSearch,
  useSelectableRows,
} from './admin-table-shared';

type TabKey = 'anime' | 'history';

interface AnimeRow {
  id: number;
  title: string;
  originalTitle?: string;
  status: string;
  score: number | null;
  progress: number;
  totalEpisodes: number | null;
  createdAt: string;
  updatedAt: string;
  lastWatchedAt?: string;
}

interface HistoryRow {
  id: number;
  animeId: number;
  animeTitle: string;
  episode: number;
  watchedAt: string;
}

interface UndoPreview {
  historyId: number;
  animeId: number;
  animeTitle: string;
  episode: number;
  currentProgress: number;
  targetProgress: number;
  affectedHistoryCount: number;
  firstAffectedEpisode: number | null;
  lastAffectedEpisode: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  watching: '追番中',
  completed: '已看完',
  dropped: '已弃坑',
  plan_to_watch: '计划看',
};

const STATUS_COLOR: Record<string, string> = {
  watching: 'text-[var(--color-watching)]',
  completed: 'text-[var(--color-completed)]',
  dropped: 'text-[var(--text-muted)]',
  plan_to_watch: 'text-[var(--color-plan)]',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] py-3 last:border-0">
      <dt className="shrink-0 text-sm text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-[var(--text-secondary)] break-words">{children}</dd>
    </div>
  );
}

function BatchManageButton({ active, selectedCount, onClick }: {
  active: boolean;
  selectedCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-medium transition-all ${active ? 'theme-accent-button' : 'theme-accent-soft'}`}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a3 3 0 006 0M9 5a3 3 0 016 0m-7 7l2 2 4-4" />
      </svg>
      {active ? `完成${selectedCount > 0 ? ` (${selectedCount})` : ''}` : '批量管理'}
    </button>
  );
}

// ─────────────────────────────────────────────
// Anime Records Tab
// ─────────────────────────────────────────────

function AnimeTab() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [batchMode, setBatchMode] = useState(false);
  const [activeRecord, setActiveRecord] = useState<AnimeRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: number[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { search, searchInput, handleSearchInput } = useDebouncedSearch(() => {
    setPage(1);
    setActiveRecord(null);
  });

  // SWR key 随分页/搜索变化自动重建
  const swrKey = useMemo(
    () => adminAnimeKey({ page, pageSize, search }),
    [page, pageSize, search],
  );

  const { data, isLoading, mutate } = useSWR<{ records: AnimeRow[]; total: number }>(
    swrKey,
    swrFetcher,
  );

  const records = data?.records ?? [];
  const total = data?.total ?? 0;

  const { selected, clearSelection, removeSelected, toggleSelect, toggleSelectAll } = useSelectableRows(records);

  // 搜索变化时清除已选项（在 useSelectableRows 之后执行）
  const prevSearchRef = useRef(search);
  useEffect(() => {
    if (prevSearchRef.current !== search) {
      clearSelection();
      prevSearchRef.current = search;
    }
  }, [search, clearSelection]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = records.length > 0 && records.every((record) => selected.has(record.id));

  const handleDelete = async (ids: number[]) => {
    setDeleting(true);
    try {
      await fetchJson<{ deleted: number }>('/api/admin/anime', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }, '删除失败');
      toast.success(`已删除 ${ids.length} 条番剧记录`);
      if (activeRecord && ids.includes(activeRecord.id)) setActiveRecord(null);
      removeSelected(ids);
      // 全局缓存刷新：管理页当前页 + 番剧全量列表 + Dashboard
      mutate();
      globalMutate(ANIME_LIST_KEY);
      globalMutate(HISTORY_KEY);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <SearchBar value={searchInput} onChange={handleSearchInput} placeholder="搜索番剧名称..." />
            {batchMode && <DeleteButton count={selected.size} onClick={() => setConfirmDelete({ ids: Array.from(selected) })} disabled={deleting} />}
            <BatchManageButton active={batchMode} selectedCount={selected.size} onClick={() => {
              if (batchMode) clearSelection();
              setBatchMode((current) => !current);
            }} />
          </div>

          <div className="glass-panel rounded-3xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-left text-sm">
                    {batchMode && <th className="px-4 py-4 w-12"><Checkbox checked={allSelected} onChange={toggleSelectAll} /></th>}
                    <th className="px-4 py-4 font-medium">番剧</th>
                    <th className="px-4 py-4 font-medium">状态</th>
                    <th className="px-4 py-4 font-medium">进度</th>
                    <th className="px-4 py-4 w-12"><span className="sr-only">查看</span></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows cols={batchMode ? 5 : 4} />
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={batchMode ? 5 : 4} className="px-5 py-16 text-center text-[var(--text-muted)] text-base">
                        {search ? '没有找到匹配的番剧' : '暂无番剧记录'}
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => batchMode ? toggleSelect(r.id) : setActiveRecord(r)}
                        className={`border-b border-[var(--border)] cursor-pointer transition-colors ${!batchMode && activeRecord?.id === r.id ? 'bg-[var(--color-surface-hover)]' : selected.has(r.id) ? 'bg-[var(--color-surface-raised)]' : 'hover:bg-[var(--color-surface-hover)]'}`}
                      >
                        {batchMode && (
                          <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                            <Checkbox checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                          </td>
                        )}
                        <td className="px-4 py-4 min-w-0">
                          <div className="text-[var(--text-secondary)] font-medium text-base truncate max-w-sm" title={r.title}>{r.title}</div>
                          {r.originalTitle && <div className="mt-0.5 truncate max-w-sm text-sm text-[var(--text-muted)]">{r.originalTitle}</div>}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-sm font-medium ${STATUS_COLOR[r.status] || 'text-[var(--text-muted)]'}`}>
                            {STATUS_LABEL[r.status] || r.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)] tabular-nums">
                          {r.progress}{r.totalEpisodes ? ` / ${r.totalEpisodes}` : ''} 集
                        </td>
                        <td className="px-4 py-4 text-[var(--text-muted)]" aria-hidden="true">›</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={(nextPage) => {
              setPage(nextPage);
              setActiveRecord(null);
            }} />
          </div>
        </div>

        <aside className="glass-panel rounded-3xl border border-[var(--border)] p-5 xl:sticky xl:top-6">
          {activeRecord ? (
            <>
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">番剧详情</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{activeRecord.title}</h2>
                {activeRecord.originalTitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{activeRecord.originalTitle}</p>}
              </div>
              <dl>
                <DetailItem label="记录 ID">#{activeRecord.id}</DetailItem>
                <DetailItem label="状态"><span className={STATUS_COLOR[activeRecord.status]}>{STATUS_LABEL[activeRecord.status] || activeRecord.status}</span></DetailItem>
                <DetailItem label="观看进度">{activeRecord.progress}{activeRecord.totalEpisodes ? ` / ${activeRecord.totalEpisodes}` : ''} 集</DetailItem>
                <DetailItem label="评分">{activeRecord.score != null ? `${activeRecord.score} 分` : '未评分'}</DetailItem>
                <DetailItem label="最近观看">{activeRecord.lastWatchedAt ? formatDate(activeRecord.lastWatchedAt) : '暂无记录'}</DetailItem>
                <DetailItem label="创建时间">{formatDate(activeRecord.createdAt)}</DetailItem>
                <DetailItem label="更新时间">{formatDate(activeRecord.updatedAt)}</DetailItem>
              </dl>
              <div className="mt-5 flex gap-2">
                <a href={`/anime/${activeRecord.id}`} className="theme-accent-soft flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-center text-sm font-medium transition-all">
                  打开番剧详情
                </a>
                <button type="button" onClick={() => setConfirmDelete({ ids: [activeRecord.id] })} disabled={deleting} className="theme-accent-soft rounded-2xl px-4 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50">
                  删除
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">数据概览</p>
              <div className="mt-4 rounded-2xl bg-[var(--color-surface-hover)] p-5">
                <div className="text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{total}</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">部番剧记录</div>
              </div>
              <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">点击左侧任意一行，在这里查看完整字段和管理操作。需要多选时，请点击“批量管理”。</p>
              {batchMode && selected.size > 0 && <p className="mt-3 text-sm text-[var(--color-completed)]">当前已勾选 {selected.size} 条记录</p>}
            </>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="确认删除番剧"
        message={
          confirmDelete && confirmDelete.ids.length > 1
            ? `确定要删除选中的 ${confirmDelete.ids.length} 部番剧吗？相关的观看记录也会一起删除，此操作不可撤销。`
            : '确定要删除这部番剧吗？相关的观看记录也会一起删除，此操作不可撤销。'
        }
        confirmText="删除"
        variant="danger"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.ids)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// History Records Tab
// ─────────────────────────────────────────────

function HistoryTab() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [batchMode, setBatchMode] = useState(false);
  const [activeRecord, setActiveRecord] = useState<HistoryRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: number[] } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState<UndoPreview | null>(null);
  const [editingTime, setEditingTime] = useState<{ id: number; value: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const { search, searchInput, handleSearchInput } = useDebouncedSearch(() => {
    setPage(1);
    setActiveRecord(null);
    setEditingTime(null);
  });

  const swrKey = useMemo(
    () => adminHistoryKey({ page, pageSize, search }),
    [page, pageSize, search],
  );

  const { data, isLoading, mutate } = useSWR<{ records: HistoryRow[]; total: number }>(
    swrKey,
    swrFetcher,
  );

  const records = data?.records ?? [];
  const total = data?.total ?? 0;

  const { selected, clearSelection, removeSelected, toggleSelect, toggleSelectAll } = useSelectableRows(records);

  // 搜索变化时清除已选项
  const prevSearchRef = useRef(search);
  useEffect(() => {
    if (prevSearchRef.current !== search) {
      clearSelection();
      prevSearchRef.current = search;
    }
  }, [search, clearSelection]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = records.length > 0 && records.every((record) => selected.has(record.id));

  const handleDelete = async (ids: number[]) => {
    setDeleting(true);
    try {
      if (ids.length === 1) {
        await fetchJson<{ deleted: true }>(`/api/admin/history/${ids[0]}`, { method: 'DELETE' }, '删除失败');
      } else {
        await fetchJson<{ deleted: number }>('/api/admin/history', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        }, '删除失败');
      }
      toast.success(`已删除 ${ids.length} 条记录`);
      if (activeRecord && ids.includes(activeRecord.id)) setActiveRecord(null);
      removeSelected(ids);
      // 全局缓存刷新：管理页当前页 + Dashboard 历史
      mutate();
      globalMutate(HISTORY_KEY);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const openUndoPreview = async (id: number) => {
    setUndoing(true);
    try {
      const data = await fetchJson<{ preview: UndoPreview }>(
        `/api/admin/history/${id}`,
        { cache: 'no-store' },
        '读取撤销影响范围失败',
      );
      setConfirmUndo(data.preview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取撤销影响范围失败');
    } finally {
      setUndoing(false);
    }
  };

  const handleUndo = async () => {
    if (!confirmUndo || undoing) return;
    const preview = confirmUndo;
    setUndoing(true);
    try {
      const data = await fetchJson<{
        undone: true;
        result: UndoPreview;
      }>(`/api/admin/history/${preview.historyId}`, { method: 'POST' }, '撤销观看失败');

      toast.success(`已回退到第 ${data.result.targetProgress} 集`);
      setConfirmUndo(null);
      mutate();
      globalMutate(HISTORY_KEY);
      globalMutate((key) => typeof key === 'string' && (
        key === ANIME_LIST_KEY ||
        key.startsWith('/api/anime?') ||
        key === `/api/anime/${data.result.animeId}` ||
        key.startsWith('/api/admin/anime?')
      ));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '撤销观看失败');
    } finally {
      setUndoing(false);
    }
  };

  const handleSaveTime = async () => {
    if (!editingTime || savingTime) return;

    const watchedAt = new Date(editingTime.value);
    if (!editingTime.value || Number.isNaN(watchedAt.getTime())) {
      toast.error('请选择有效的观看时间');
      return;
    }

    setSavingTime(true);
    try {
      const data = await fetchJson<{ updated: true; record: HistoryRow }>(
        `/api/admin/history/${editingTime.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watchedAt: watchedAt.toISOString() }),
        },
        '修改观看时间失败',
      );
      toast.success('观看时间已修改');
      setActiveRecord(data.record);
      setEditingTime(null);
      mutate();
      globalMutate(HISTORY_KEY);
      globalMutate((key) => typeof key === 'string' && (
        key.startsWith('/api/admin/history?') ||
        key === ANIME_LIST_KEY ||
        key.startsWith('/api/anime?') ||
        key.startsWith('/api/admin/anime?')
      ));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '修改观看时间失败');
    } finally {
      setSavingTime(false);
    }
  };

  const undoRangeText = confirmUndo
    ? confirmUndo.firstAffectedEpisode === confirmUndo.lastAffectedEpisode
      ? `第 ${confirmUndo.firstAffectedEpisode} 集的 1 条记录`
      : `第 ${confirmUndo.firstAffectedEpisode}–${confirmUndo.lastAffectedEpisode} 集的 ${confirmUndo.affectedHistoryCount} 条记录`
    : '';

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <SearchBar value={searchInput} onChange={handleSearchInput} placeholder="搜索番剧名称..." />
            {batchMode && <DeleteButton count={selected.size} onClick={() => setConfirmDelete({ ids: Array.from(selected) })} disabled={deleting} />}
            <BatchManageButton active={batchMode} selectedCount={selected.size} onClick={() => {
              if (batchMode) clearSelection();
              setBatchMode((current) => !current);
            }} />
          </div>

          <div className="glass-panel rounded-3xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-left text-sm">
                    {batchMode && <th className="px-4 py-4 w-12"><Checkbox checked={allSelected} onChange={toggleSelectAll} /></th>}
                    <th className="px-4 py-4 font-medium">观看记录</th>
                    <th className="px-4 py-4 font-medium">观看时间</th>
                    <th className="px-4 py-4 w-12"><span className="sr-only">查看</span></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonRows cols={batchMode ? 4 : 3} />
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={batchMode ? 4 : 3} className="px-5 py-16 text-center text-[var(--text-muted)] text-base">
                        {search ? '没有找到匹配的记录' : '暂无历史记录'}
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => {
                          if (batchMode) {
                            toggleSelect(r.id);
                            return;
                          }
                          setActiveRecord(r);
                          setEditingTime(null);
                        }}
                        className={`border-b border-[var(--border)] cursor-pointer transition-colors ${!batchMode && activeRecord?.id === r.id ? 'bg-[var(--color-surface-hover)]' : selected.has(r.id) ? 'bg-[var(--color-surface-raised)]' : 'hover:bg-[var(--color-surface-hover)]'}`}
                      >
                        {batchMode && (
                          <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                            <Checkbox checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                          </td>
                        )}
                        <td className="px-4 py-4 min-w-0">
                          <div className="truncate max-w-sm text-base font-medium text-[var(--text-secondary)]" title={r.animeTitle}>{r.animeTitle}</div>
                          <div className="mt-0.5 text-sm text-[var(--text-muted)]">第 {r.episode} 集</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-[var(--text-muted)] tabular-nums">{formatDate(r.watchedAt)}</td>
                        <td className="px-4 py-4 text-[var(--text-muted)]" aria-hidden="true">›</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={(nextPage) => {
              setPage(nextPage);
              setActiveRecord(null);
              setEditingTime(null);
            }} />
          </div>
        </div>

        <aside className="glass-panel rounded-3xl border border-[var(--border)] p-5 xl:sticky xl:top-6">
          {activeRecord ? (
            <>
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">观看详情</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{activeRecord.animeTitle}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">第 {activeRecord.episode} 集</p>
              </div>
              <dl>
                <DetailItem label="记录 ID">#{activeRecord.id}</DetailItem>
                <DetailItem label="番剧 ID">#{activeRecord.animeId}</DetailItem>
                <DetailItem label="观看集数">第 {activeRecord.episode} 集</DetailItem>
                <DetailItem label="观看时间">{formatDate(activeRecord.watchedAt)}</DetailItem>
              </dl>

              {editingTime?.id === activeRecord.id ? (
                <div className="mt-5 rounded-2xl bg-[var(--color-surface-hover)] p-4">
                  <label className="block text-sm font-medium text-[var(--text-secondary)]" htmlFor={`history-time-${activeRecord.id}`}>修改观看时间</label>
                  <input
                    id={`history-time-${activeRecord.id}`}
                    type="datetime-local"
                    step="1"
                    value={editingTime.value}
                    onChange={(event) => setEditingTime({ id: activeRecord.id, value: event.target.value })}
                    disabled={savingTime}
                    className="surface-input mt-3 w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-completed)]/30 disabled:opacity-50"
                  />
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={handleSaveTime} disabled={savingTime || !editingTime.value} className="theme-accent-button flex-1 rounded-2xl px-4 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50">{savingTime ? '保存中…' : '保存'}</button>
                    <button type="button" onClick={() => setEditingTime(null)} disabled={savingTime} className="theme-accent-soft rounded-2xl px-4 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50">取消</button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  <button type="button" onClick={() => setEditingTime({ id: activeRecord.id, value: toDateTimeLocalValue(activeRecord.watchedAt) })} disabled={deleting || undoing || savingTime} className="theme-accent-soft flex items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    修改时间
                  </button>
                  <button type="button" onClick={() => openUndoPreview(activeRecord.id)} disabled={deleting || undoing || savingTime} className="theme-accent-soft flex items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15l-6-6m0 0l6-6M3 9h11a7 7 0 010 14h-1" /></svg>
                    撤销观看
                  </button>
                  <button type="button" onClick={() => setConfirmDelete({ ids: [activeRecord.id] })} disabled={deleting || undoing || savingTime} className="theme-accent-soft flex items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    删除
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">数据概览</p>
              <div className="mt-4 rounded-2xl bg-[var(--color-surface-hover)] p-5">
                <div className="text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{total}</div>
                <div className="mt-1 text-sm text-[var(--text-muted)]">条观看记录</div>
              </div>
              <p className="mt-5 text-sm leading-6 text-[var(--text-muted)]">点击左侧记录后，可以在这里修改观看时间、撤销观看或删除记录。需要多选时，请点击“批量管理”。</p>
              {batchMode && selected.size > 0 && <p className="mt-3 text-sm text-[var(--color-completed)]">当前已勾选 {selected.size} 条记录</p>}
            </>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="确认删除"
        message={
          confirmDelete && confirmDelete.ids.length > 1
            ? `确定要删除选中的 ${confirmDelete.ids.length} 条观看记录吗？此操作不可撤销。`
            : '确定要删除这条观看记录吗？此操作不可撤销。'
        }
        confirmText="删除"
        variant="danger"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.ids)}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={confirmUndo !== null}
        title="撤销观看并回退进度"
        message={confirmUndo
          ? `撤销《${confirmUndo.animeTitle}》第 ${confirmUndo.episode} 集后，当前进度将从第 ${confirmUndo.currentProgress} 集回退到第 ${confirmUndo.targetProgress} 集，并删除${undoRangeText}。此操作不可撤销。`
          : ''}
        confirmText={undoing ? '正在撤销…' : '确认撤销'}
        variant="warning"
        onConfirm={handleUndo}
        onCancel={() => !undoing && setConfirmUndo(null)}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function AdminPageClient() {
  const { canManage, isLoading: accessLoading } = useRuntimeAccess();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>('anime');

  useEffect(() => {
    if (!accessLoading && !canManage) {
      router.replace('/');
    }
  }, [accessLoading, canManage, router]);

  if (accessLoading || !canManage) {
    return <main className="p-6 text-[var(--text-muted)]">验证权限中...</main>;
  }

  return (
    <main className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display tracking-tight text-[var(--text-primary)]">数据管理</h1>
        <p className="text-base text-[var(--text-muted)] mt-2">管理番剧条目和观看记录</p>
      </div>

      {/* Tabs */}
      <SegmentedControl
        value={activeTab}
        options={[
          { value: 'anime', label: '番剧记录' },
          { value: 'history', label: '观看历史' },
        ]}
        onChange={setActiveTab}
        ariaLabel="数据管理类型"
        className="w-fit rounded-2xl"
        buttonClassName="px-5 py-2.5 text-sm font-medium"
        activeClassName="text-[var(--text-primary)]"
      />

      {/* Tab Content */}
      {activeTab === 'anime' ? <AnimeTab /> : <HistoryTab />}
    </main>
  );
}
