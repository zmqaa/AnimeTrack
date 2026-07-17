"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
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
  DeleteIconButton,
  EditTimeIconButton,
  Pagination,
  SearchBar,
  SkeletonRows,
  UndoWatchIconButton,
  useDebouncedSearch,
  useSelectableRows,
} from './admin-table-shared';

type TabKey = 'anime' | 'history';

interface AnimeRow {
  id: number;
  title: string;
  original_title: string | null;
  status: string;
  score: number | null;
  progress: number;
  totalEpisodes: number | null;
  createdAt: string;
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

// ─────────────────────────────────────────────
// Anime Records Tab
// ─────────────────────────────────────────────

function AnimeTab() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: number[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { search, searchInput, handleSearchInput } = useDebouncedSearch(() => {
    setPage(1);
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <SearchBar value={searchInput} onChange={handleSearchInput} placeholder="搜索番剧名称..." />
        <DeleteButton count={selected.size} onClick={() => setConfirmDelete({ ids: Array.from(selected) })} disabled={deleting} />
      </div>

      <div className="glass-panel rounded-3xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-left text-sm">
                <th className="px-5 py-4 w-12"><Checkbox checked={allSelected} onChange={toggleSelectAll} /></th>
                <th className="px-5 py-4 font-medium">ID</th>
                <th className="px-5 py-4 font-medium">标题</th>
                <th className="px-5 py-4 font-medium">状态</th>
                <th className="px-5 py-4 font-medium">评分</th>
                <th className="px-5 py-4 font-medium">进度</th>
                <th className="px-5 py-4 font-medium">创建时间</th>
                <th className="px-5 py-4 font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows cols={8} />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-[var(--text-muted)] text-base">
                    {search ? '没有找到匹配的番剧' : '暂无番剧记录'}
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className={`border-b border-[var(--border)] transition-colors ${selected.has(r.id) ? 'bg-[var(--color-surface-raised)]' : 'hover:bg-[var(--color-surface-hover)]'}`}>
                    <td className="px-5 py-4"><Checkbox checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                    <td className="px-5 py-4 text-[var(--text-muted)] tabular-nums text-sm">{r.id}</td>
                    <td className="px-5 py-4">
                      <div className="text-[var(--text-secondary)] font-medium text-base truncate max-w-xs" title={r.title}>{r.title}</div>
                      {r.original_title && (
                        <div className="text-[var(--text-muted)] text-sm mt-0.5 truncate max-w-xs" title={r.original_title}>{r.original_title}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-medium ${STATUS_COLOR[r.status] || 'text-[var(--text-muted)]'}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[var(--text-secondary)] tabular-nums text-sm">{r.score != null ? `${r.score} 分` : '—'}</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)] tabular-nums text-sm">
                      {r.progress}{r.totalEpisodes ? ` / ${r.totalEpisodes}` : ''} 集
                    </td>
                    <td className="px-5 py-4 text-[var(--text-muted)] tabular-nums text-sm">{formatDate(r.createdAt)}</td>
                    <td className="px-5 py-4">
                      <DeleteIconButton onClick={() => setConfirmDelete({ ids: [r.id] })} disabled={deleting} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} />
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
  const [confirmDelete, setConfirmDelete] = useState<{ ids: number[] } | null>(null);
  const [confirmUndo, setConfirmUndo] = useState<UndoPreview | null>(null);
  const [editingTime, setEditingTime] = useState<{ id: number; value: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const { search, searchInput, handleSearchInput } = useDebouncedSearch(() => {
    setPage(1);
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
      await fetchJson<{ updated: true; record: HistoryRow }>(
        `/api/admin/history/${editingTime.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watchedAt: watchedAt.toISOString() }),
        },
        '修改观看时间失败',
      );
      toast.success('观看时间已修改');
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <SearchBar value={searchInput} onChange={handleSearchInput} placeholder="搜索番剧名称..." />
        <DeleteButton count={selected.size} onClick={() => setConfirmDelete({ ids: Array.from(selected) })} disabled={deleting} />
      </div>

      <div className="glass-panel rounded-3xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)] text-left text-sm">
                <th className="px-5 py-4 w-12"><Checkbox checked={allSelected} onChange={toggleSelectAll} /></th>
                <th className="px-5 py-4 font-medium">ID</th>
                <th className="px-5 py-4 font-medium">番剧名称</th>
                <th className="px-5 py-4 font-medium">集数</th>
                <th className="px-5 py-4 font-medium">观看时间</th>
                <th className="px-5 py-4 font-medium w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows cols={6} />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-[var(--text-muted)] text-base">
                    {search ? '没有找到匹配的记录' : '暂无历史记录'}
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className={`border-b border-[var(--border)] transition-colors ${selected.has(r.id) ? 'bg-[var(--color-surface-raised)]' : 'hover:bg-[var(--color-surface-hover)]'}`}>
                    <td className="px-5 py-4"><Checkbox checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                    <td className="px-5 py-4 text-[var(--text-muted)] tabular-nums text-sm">{r.id}</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)] font-medium text-base truncate max-w-xs" title={r.animeTitle}>{r.animeTitle}</td>
                    <td className="px-5 py-4 text-[var(--text-secondary)] tabular-nums text-sm">第 {r.episode} 集</td>
                    <td className="px-5 py-4 text-[var(--text-muted)] tabular-nums text-sm">
                      {editingTime?.id === r.id ? (
                        <input
                          type="datetime-local"
                          step="1"
                          value={editingTime.value}
                          onChange={(event) => setEditingTime({ id: r.id, value: event.target.value })}
                          disabled={savingTime}
                          aria-label={`${r.animeTitle} 第 ${r.episode} 集的观看时间`}
                          className="surface-input min-w-52 rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-completed)]/30 disabled:opacity-50"
                        />
                      ) : formatDate(r.watchedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        {editingTime?.id === r.id ? (
                          <>
                            <button
                              type="button"
                              onClick={handleSaveTime}
                              disabled={savingTime || !editingTime.value}
                              className="px-3 py-2 rounded-xl text-sm font-medium text-[var(--color-completed)] hover:bg-[var(--color-completed)]/10 transition-all disabled:opacity-50"
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTime(null)}
                              disabled={savingTime}
                              className="px-3 py-2 rounded-xl text-sm text-[var(--text-muted)] hover:bg-[var(--color-surface-hover)] transition-all disabled:opacity-50"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <EditTimeIconButton
                              onClick={() => setEditingTime({ id: r.id, value: toDateTimeLocalValue(r.watchedAt) })}
                              disabled={deleting || undoing || savingTime}
                            />
                            <UndoWatchIconButton onClick={() => openUndoPreview(r.id)} disabled={deleting || undoing || savingTime} />
                            <DeleteIconButton onClick={() => setConfirmDelete({ ids: [r.id] })} disabled={deleting || undoing || savingTime} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} />
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
