"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { MagnifyingGlassIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import SegmentedControl from '@/components/shared/SegmentedControl';
import toast from 'react-hot-toast';
import AnimeHeader from '@/components/anime/AnimeHeader';
import AnimeFilterBar from '@/components/anime/AnimeFilterBar';
import AnimeForm from '@/components/anime/AnimeForm';
import AnimeGrid, { type ViewMode } from '@/components/anime/AnimeGrid';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PageContainer from '@/components/shared/PageContainer';
import { fetchJson, fetchNdjson } from '@/lib/client-api';
import type { AnimeStatus, AnimeSortBy, AnimeListItem, AnimeCardItem, AnimeListOverview } from '@/lib/anime-shared';
import type { QuickRecordProgressEvent, QuickRecordStreamEvent } from '@/lib/quick-record-progress';
import { useManageAccess } from '@/hooks/useManageAccess';
import { ANIME_LIST_KEY, ANIME_OVERVIEW_KEY, isHistoryKey, animePageKey, swrFetcher } from '@/lib/swr-config';
import AnimePagination from './AnimePagination';
import AnimeQuickRecordPanel from './AnimeQuickRecordPanel';
import AnimeSidebar from './AnimeSidebar';
import {
  buildQuickRecordMessage,
  buildAnimeListUrlParams,
  parseAnimeListUrlState,
  QuickRecordResponse,
} from './anime-page-helpers';

const ANIME_LIST_SCROLL_KEY = 'anime-list-scroll-y';
const EMPTY_OVERVIEW: AnimeListOverview = {
  stats: {
    total: 0,
    watching: 0,
    completed: 0,
    unfinished: 0,
    watchedEpisodes: 0,
    totalMinutes: 0,
  },
  tagPreferences: [],
  voiceActorSuggestions: [],
  recentWatchItems: [],
};

export default function AnimePageClient() {
  const { canManage: isAdmin } = useManageAccess();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlState = useMemo(
    () => parseAnimeListUrlState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  // ── SWR: 轻量概览（侧边栏统计、筛选建议、最近观看）──────────────────
  const {
    data: overview = EMPTY_OVERVIEW,
    isLoading: overviewLoading,
    mutate: mutateOverview,
  } = useSWR<AnimeListOverview>(
    ANIME_OVERVIEW_KEY,
    swrFetcher,
  );

  // ── 筛选/排序/分页状态 ───────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<AnimeStatus | 'all'>(() => urlState.status);
  const [searchQuery, setSearchQuery] = useState(() => urlState.search);
  const [castQuery, setCastQuery] = useState(() => urlState.cast);
  const [tagFilter, setTagFilter] = useState(() => urlState.tag);
  const [sortBy, setSortBy] = useState<AnimeSortBy>(() => urlState.sortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => urlState.sortOrder);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressMutationIdsRef = useRef(new Set<number>());
  const [debouncedSearch, setDebouncedSearch] = useState(() => urlState.search);
  const hasRestoredScrollRef = useRef(false);

  // ── 表单状态 ─────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [quickInput, setQuickInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [quickProgress, setQuickProgress] = useState<QuickRecordProgressEvent[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingProgressIds, setUpdatingProgressIds] = useState<Set<number>>(() => new Set());

  const [formData, setFormData] = useState({
    title: '',
    originalTitle: '',
    progress: '0',
    totalEpisodes: '',
    status: 'watching' as AnimeStatus,
    notes: '',
    coverUrl: '',
    localCoverUrl: '',
    displayCoverUrl: '',
    tags: '',
    durationMinutes: '',
    startDate: '',
    endDate: '',
    isFinished: false,
  });

  // ── 客户端挂载后恢复 UI 偏好 ─────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('anime_view_mode');
    if (saved === 'list' || saved === 'grid') {
      setViewMode(saved);
    }
  }, []);

  // ── URL 状态管理 ─────────────────────────────────────────────────────
  const currentPage = urlState.page;

  const updateListUrl = useCallback((
    patch: Parameters<typeof buildAnimeListUrlParams>[1],
    mode: 'push' | 'replace' = 'push',
  ) => {
    const params = buildAnimeListUrlParams(
      new URLSearchParams(searchParams.toString()),
      patch,
    );
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    const current = searchParams.toString();
    const currentTarget = current ? `${pathname}?${current}` : pathname;
    if (target === currentTarget) return;
    router[mode](target, { scroll: false });
  }, [pathname, router, searchParams]);

  const setCurrentPage = useCallback((page: number) => {
    updateListUrl({ page: Math.max(1, page) });
  }, [updateListUrl]);

  const changeStatus = useCallback((status: AnimeStatus | 'all') => {
    setFilterStatus(status);
    updateListUrl({ status, page: 1 });
  }, [updateListUrl]);

  const changeCast = useCallback((cast: string) => {
    setCastQuery(cast);
    updateListUrl({ cast, page: 1 }, 'replace');
  }, [updateListUrl]);

  const changeSortBy = useCallback((nextSortBy: AnimeSortBy) => {
    setSortBy(nextSortBy);
    updateListUrl({ sortBy: nextSortBy, page: 1 });
  }, [updateListUrl]);

  const changeSortOrder = useCallback((nextSortOrder: 'asc' | 'desc') => {
    setSortOrder(nextSortOrder);
    updateListUrl({ sortOrder: nextSortOrder, page: 1 });
  }, [updateListUrl]);

  const pageSize = 12;
  const returnTo = useMemo(() => {
    const params = buildAnimeListUrlParams(
      new URLSearchParams(searchParams.toString()),
      {
        status: filterStatus,
        search: searchQuery,
        cast: castQuery,
        tag: tagFilter,
        sortBy,
        sortOrder,
        page: currentPage,
      },
    );
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [castQuery, currentPage, filterStatus, pathname, searchParams, searchQuery, sortBy, sortOrder, tagFilter]);

  // ── 搜索防抖 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // 将搜索词写入 URL，进入详情页后可通过 returnTo 完整恢复列表状态。
  useEffect(() => {
    const trimmedSearch = debouncedSearch.trim();
    if (urlState.search === trimmedSearch) return;
    updateListUrl({ search: trimmedSearch, page: 1 }, 'replace');
  }, [debouncedSearch, updateListUrl, urlState.search]);

  // 浏览器前进/后退或外部链接改变 URL 时，恢复完整列表控制状态。
  useEffect(() => {
    setFilterStatus(urlState.status);
    setSearchQuery(urlState.search);
    setDebouncedSearch(urlState.search);
    setCastQuery(urlState.cast);
    setTagFilter(urlState.tag);
    setSortBy(urlState.sortBy);
    setSortOrder(urlState.sortOrder);
  }, [
    urlState.cast,
    urlState.search,
    urlState.sortBy,
    urlState.sortOrder,
    urlState.status,
    urlState.tag,
  ]);

  // ── SWR: 服务端筛选、排序和分页列表 ─────────────────────────────────
  const swrPageKey = useMemo(() => {
    return animePageKey({
      page: currentPage,
      pageSize,
      status: filterStatus,
      search: debouncedSearch,
      cast: castQuery,
      tag: tagFilter,
      sortBy,
      sortOrder,
    });
  }, [currentPage, pageSize, filterStatus, debouncedSearch, sortBy, sortOrder, castQuery, tagFilter]);

  const {
    data: pageResult,
    isLoading: pageLoading,
  } = useSWR<{ records: AnimeListItem[]; total: number; page: number; totalPages: number }>(
    swrPageKey,
    swrFetcher,
  );

  const paginatedRecords = useMemo(() => pageResult?.records ?? [], [pageResult?.records]);
  const totalCount = pageResult?.total ?? 0;
  const totalPages = pageResult?.totalPages ?? 1;

  // ── 滚动位置恢复 ─────────────────────────────────────────────────────
  const loading = pageLoading;
  useEffect(() => {
    if (loading || hasRestoredScrollRef.current) return;

    const rawScroll = sessionStorage.getItem(ANIME_LIST_SCROLL_KEY);
    if (!rawScroll) return;

    const scrollY = Number(rawScroll);
    if (!Number.isFinite(scrollY) || scrollY < 0) {
      sessionStorage.removeItem(ANIME_LIST_SCROLL_KEY);
      return;
    }

    hasRestoredScrollRef.current = true;
    sessionStorage.removeItem(ANIME_LIST_SCROLL_KEY);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  }, [loading]);

  // ── 表单操作 ─────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      title: '',
      originalTitle: '',
      progress: '0',
      totalEpisodes: '',
      status: 'watching',
      notes: '',
      coverUrl: '',
      localCoverUrl: '',
      displayCoverUrl: '',
      tags: '',
      durationMinutes: '',
      startDate: '',
      endDate: '',
      isFinished: false,
    });
  }, []);

  const startEdit = useCallback((item: AnimeCardItem) => {
    setEditingId(item.id);
    setFormData({
      title: item.title,
      originalTitle: item.originalTitle || '',
      progress: String(item.progress),
      totalEpisodes: item.totalEpisodes ? String(item.totalEpisodes) : '',
      status: item.status,
      notes: item.notes || '',
      coverUrl: item.coverUrl || '',
      localCoverUrl: item.localCoverUrl || '',
      displayCoverUrl: item.displayCoverUrl || '',
      tags: item.tags ? item.tags.join(', ') : '',
      durationMinutes: item.durationMinutes ? String(item.durationMinutes) : '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      isFinished: item.isFinished || false,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /** 表单保存/新建后的回调 — 刷新概览、当前分页和 Dashboard 缓存 */
  const handleFormSaved = useCallback(() => {
    mutateOverview();
    globalMutate(swrPageKey);
    globalMutate(ANIME_LIST_KEY);
  }, [mutateOverview, swrPageKey]);

  const toggleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    sessionStorage.setItem('anime_view_mode', mode);
  }, []);

  // ── 进度更新（乐观更新 + API） ──────────────────────────────────────
  const updateProgress = useCallback(async (id: number, delta: -1 | 1) => {
    if (progressMutationIdsRef.current.has(id)) return;
    progressMutationIdsRef.current.add(id);
    setUpdatingProgressIds(new Set(progressMutationIdsRef.current));

    // 乐观更新函数
    const applyProgressPatch = (item: AnimeListItem): AnimeListItem => {
      if (item.id !== id) return item;
      const upperBound = item.totalEpisodes && item.totalEpisodes > 0
        ? item.totalEpisodes
        : Number.MAX_SAFE_INTEGER;
      const progress = Math.min(upperBound, Math.max(0, item.progress + delta));
      const updated: AnimeListItem = { ...item, progress };
      if (item.totalEpisodes && progress >= item.totalEpisodes) {
        updated.status = 'completed';
      } else if (delta < 0 && item.status === 'completed') {
        updated.status = 'watching';
      }
      return updated;
    };

    const applyServerEntry = (entry: AnimeListItem) => (item: AnimeListItem): AnimeListItem => (
      item.id === entry.id ? { ...item, ...entry } : item
    );

    const patchPageRecords = (
      data: { records: AnimeListItem[]; total: number; page: number; totalPages: number } | undefined,
      patchItem: (item: AnimeListItem) => AnimeListItem,
    ) => data ? { ...data, records: data.records.map(patchItem) } : data;

    try {
      // 1) 乐观更新当前分页列表（网格即时刷新）
      await globalMutate(
        swrPageKey,
        (data: { records: AnimeListItem[]; total: number; page: number; totalPages: number } | undefined) => patchPageRecords(data, applyProgressPatch),
        { revalidate: false },
      );

      // 2) 发送 API 请求
      const result = await fetchJson<{ ok: true; entry: AnimeListItem }>(`/api/anime/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progressDelta: delta,
          recordHistory: true,
          trimHistoryOnProgressDecrease: true,
        }),
      }, '更新失败，请重试');

      const serverPatch = applyServerEntry(result.entry);

      // 3) 先用服务端最终记录同步当前缓存，再后台重验证
      await globalMutate(
        swrPageKey,
        (data: { records: AnimeListItem[]; total: number; page: number; totalPages: number } | undefined) => patchPageRecords(data, serverPatch),
        { revalidate: false },
      );

      globalMutate(swrPageKey);
      mutateOverview();
      globalMutate(ANIME_LIST_KEY);
      globalMutate(isHistoryKey);

      const isFinishing = Boolean(
        result.entry.totalEpisodes
        && result.entry.progress >= result.entry.totalEpisodes,
      );
      if (isFinishing) {
        toast.success('🎉 恭喜完结！');
      } else {
        toast.success(`已更新进度至 EP ${result.entry.progress}`);
      }
    } catch (err) {
      console.error('Update failed:', err);
      // 回滚：直接重验证
      globalMutate(swrPageKey);
      mutateOverview();
      globalMutate(isHistoryKey);
      toast.error(err instanceof Error ? err.message : '更新失败，请重试');
    } finally {
      progressMutationIdsRef.current.delete(id);
      setUpdatingProgressIds(new Set(progressMutationIdsRef.current));
    }
  }, [mutateOverview, swrPageKey]);

  // ── 删除操作 ─────────────────────────────────────────────────────────
  const deleteAnime = useCallback(async (id: number) => {
    const item = paginatedRecords.find(i => i.id === id)
      || overview.recentWatchItems.find(i => i.id === id);
    setDeleteConfirm({ id, title: item?.title || '这部番剧' });
  }, [overview.recentWatchItems, paginatedRecords]);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm || deleting) return;
    const { id } = deleteConfirm;
    setDeleting(true);
    try {
      await fetchJson<{ ok: true }>(`/api/anime/${id}`, { method: 'DELETE' }, '删除失败');
      resetForm();
      toast.success('已删除');
      // 全局重验证：概览 + 当前分页 + Dashboard
      mutateOverview();
      globalMutate(ANIME_LIST_KEY);
      globalMutate(swrPageKey);
      globalMutate(isHistoryKey);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error(err instanceof Error ? err.message : '删除失败，请重试');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleting, mutateOverview, resetForm, swrPageKey]);

  // ── AI 快捷录入 ─────────────────────────────────────────────────────
  const handleQuickRecord = useCallback(async () => {
    const text = quickInput.trim();
    if (!text) {
      setQuickMessage('请输入动漫名称');
      return;
    }

    setQuickLoading(true);
    setQuickMessage('');
    setQuickProgress([]);

    try {
      let data: QuickRecordResponse | undefined;
      let streamError = '';
      await fetchNdjson<QuickRecordStreamEvent<QuickRecordResponse>>('/api/anime/quick-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, stream: true }),
      }, (event) => {
        if (event.type === 'progress') {
          setQuickProgress((current) => [...current, event]);
        } else if (event.type === 'result') {
          data = event.data;
        } else if (event.type === 'error') {
          streamError = event.error;
        }
      }, 'AI录入失败');

      if (streamError) throw new Error(streamError);
      if (!data) throw new Error('AI录入失败：服务未返回最终结果');

      setQuickInput('');
      toast.success('AI 录入成功');
      setQuickMessage(buildQuickRecordMessage(data));
      // 刷新概览 + 当前分页 + Dashboard
      mutateOverview();
      globalMutate(swrPageKey);
      globalMutate(ANIME_LIST_KEY);
      globalMutate(isHistoryKey);
    } catch (error) {
      console.error('Quick record failed:', error);
      const message = error instanceof Error ? error.message : 'AI录入失败，请稍后重试';
      setQuickProgress((current) => [
        ...current,
        {
          type: 'progress',
          stage: 'complete',
          status: 'error',
          message: '录入流程中止',
          detail: message,
        },
      ]);
      setQuickMessage(message);
      toast.error(message);
    } finally {
      setQuickLoading(false);
    }
  }, [quickInput, mutateOverview, swrPageKey]);

  const toggleTagFilter = useCallback((tag: string) => {
    const nextTag = tagFilter === tag ? '' : tag;
    setTagFilter(nextTag);
    updateListUrl({ tag: nextTag, page: 1 });
  }, [tagFilter, updateListUrl]);

  const displayTotalPages = totalPages;
  const safePage = Math.min(currentPage, displayTotalPages);

  useEffect(() => {
    if (loading) return;
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
  }, [safePage, currentPage, loading, setCurrentPage]);

  const pagedItems = paginatedRecords;
  const displayTotal = totalCount;
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    castQuery.trim() ||
    tagFilter ||
    filterStatus !== 'all'
  );
  const rememberListScroll = useCallback(() => {
    sessionStorage.setItem(ANIME_LIST_SCROLL_KEY, String(window.scrollY));
  }, []);

  // ── 渲染 ─────────────────────────────────────────────────────────────
  return (
    <PageContainer as="main" width="wide" spacing="roomy">
      <AnimeHeader
        showForm={showForm}
        editingId={editingId}
        setShowForm={setShowForm}
        resetForm={resetForm}
        isAdmin={isAdmin}
        totalCount={overview.stats.total}
        watchingCount={overview.stats.watching}
        completedCount={overview.stats.completed}
        loading={overviewLoading}
      />

      {isAdmin && (
        <AnimeQuickRecordPanel
          quickInput={quickInput}
          quickLoading={quickLoading}
          quickMessage={quickMessage}
          quickProgress={quickProgress}
          onInputChange={setQuickInput}
          onSubmit={handleQuickRecord}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-4">
            {/* 搜索框 + 视图切换 */}
            <div className="flex gap-3">
              <div className="theme-focus-parent relative group shadow-sm flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="theme-focus-icon h-5 w-5 text-[var(--text-muted)] transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="搜索番剧、原名或声优..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="surface-input theme-focus-accent block w-full pl-11 pr-4 py-3 rounded-2xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-all shadow-xl"
                />
              </div>
              <SegmentedControl
                value={viewMode}
                options={[
                  { value: 'grid', label: '网格视图', icon: Squares2X2Icon },
                  { value: 'list', label: '列表视图', icon: ListBulletIcon },
                ]}
                onChange={toggleViewMode}
                ariaLabel="番剧展示方式"
                className="flex-shrink-0 rounded-2xl"
                buttonClassName="p-3"
                activeClassName="theme-accent-text"
                iconClassName="h-5 w-5"
                iconOnly
              />
            </div>

            <AnimeFilterBar
              filterStatus={filterStatus}
              setFilterStatus={changeStatus}
              castQuery={castQuery}
              setCastQuery={changeCast}
              voiceActorSuggestions={overview.voiceActorSuggestions}
              sortBy={sortBy}
              setSortBy={changeSortBy}
              sortOrder={sortOrder}
              setSortOrder={changeSortOrder}
              itemsCount={displayTotal}
            />

            {tagFilter && (
              <div className="flex items-center justify-between rounded-xl status-plan-soft px-3 py-2">
                <span className="text-xs text-[var(--color-plan)]">已按标签筛选：#{tagFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTagFilter('');
                    updateListUrl({ tag: '', page: 1 });
                  }}
                  className="text-[11px] text-[var(--color-plan)]/80 hover:text-[var(--text-primary)]"
                >
                  清除
                </button>
              </div>
            )}
          </div>

          {isAdmin && showForm && (
            <AnimeForm
              key={editingId || 'new'}
              editingId={editingId}
              initialData={formData}
              resetForm={resetForm}
              onSaved={handleFormSaved}
              deleteAnime={deleteAnime}
            />
          )}

          <AnimeGrid
            items={pagedItems}
            updateProgress={updateProgress}
            updatingProgressIds={updatingProgressIds}
            loading={loading}
            isAdmin={isAdmin}
            viewMode={viewMode}
            detailReturnTo={returnTo}
            onOpenDetail={rememberListScroll}
            emptyTitle={hasActiveFilters ? '没有找到匹配的番剧' : '暂无番剧记录'}
            emptyDescription={hasActiveFilters
              ? '试试缩短关键词、切换状态，或清除当前筛选条件。'
              : '添加第一部番剧后，它会显示在这里。'}
          />

          <AnimePagination
            loading={loading}
            itemsCount={displayTotal}
            currentPage={safePage}
            totalPages={displayTotalPages}
            onPageChange={setCurrentPage}
          />
        </div>

        <AnimeSidebar
          stats={overview.stats}
          tagPreferences={overview.tagPreferences}
          tagFilter={tagFilter}
          recentWatchItems={overview.recentWatchItems}
          isAdmin={isAdmin}
          onToggleTagFilter={toggleTagFilter}
          onEdit={startEdit}
        />
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="删除番剧"
        message={`确定要删除「${deleteConfirm?.title || ''}」吗？删除后其观看历史也会一并清除，无法恢复。`}
        confirmText={deleting ? '正在删除…' : '确认删除'}
        cancelText="再想想"
        variant="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteConfirm(null)}
      />
    </PageContainer>
  );
}
