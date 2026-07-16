"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR, { mutate as globalMutate } from 'swr';
import { MagnifyingGlassIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline';
import SegmentedControl from '@/components/shared/SegmentedControl';
import toast from 'react-hot-toast';
import AnimeHeader from '@/components/anime/AnimeHeader';
import AnimeFilterBar from '@/components/anime/AnimeFilterBar';
import AnimeForm from '@/components/anime/AnimeForm';
import AnimeGrid, { type ViewMode } from '@/components/anime/AnimeGrid';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { fetchJson } from '@/lib/client-api';
import type { AnimeStatus, AnimeSortBy, SessionUser, AnimeListItem, AnimeCardItem } from '@/lib/anime-shared';
import { ANIME_LIST_KEY, HISTORY_KEY, animePageKey, swrFetcher } from '@/lib/swr-config';
import AnimePagination from './AnimePagination';
import AnimeQuickRecordPanel from './AnimeQuickRecordPanel';
import AnimeSidebar from './AnimeSidebar';
import {
  buildQuickRecordMessage,
  buildRecentWatchItems,
  buildTagPreferences,
  buildVoiceActorSuggestions,
  filterAndSortAnimeItems,
  QuickRecordResponse,
} from './anime-page-helpers';

const ANIME_LIST_SCROLL_KEY = 'anime-list-scroll-y';

export default function AnimePageClient() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = (session?.user as SessionUser | undefined)?.role === 'admin';

  // ── SWR: 全量番剧列表（侧边栏统计 + 客户端筛选降级）───────────────────
  const { data: allItems = [], isLoading: listLoading, mutate: mutateAll } = useSWR<AnimeListItem[]>(
    ANIME_LIST_KEY,
    swrFetcher,
  );

  // ── 筛选/排序/分页状态 ───────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<AnimeStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [castQuery, setCastQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState<AnimeSortBy>('lastWatchedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const hasSyncedUrlFilters = useRef(false);
  const lastFilterKeyRef = useRef('');
  const hasRestoredScrollRef = useRef(false);

  // ── 表单状态 ─────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [quickInput, setQuickInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    originalTitle: '',
    progress: '0',
    totalEpisodes: '',
    status: 'watching' as AnimeStatus,
    notes: '',
    coverUrl: '',
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

  // ── URL 页码管理 ─────────────────────────────────────────────────────
  const currentPage = useMemo(() => {
    const urlPage = Number(searchParams.get('page'));
    return Number.isFinite(urlPage) && urlPage > 0 ? urlPage : 1;
  }, [searchParams]);

  const setCurrentPage = useCallback((page: number) => {
    const nextPage = Math.max(1, page);
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    sessionStorage.setItem('anime_last_page', String(nextPage));
  }, [pathname, router, searchParams]);

  // 缺少页码时，用上次停留的页码填充 URL
  useEffect(() => {
    if (!searchParams.get('page')) {
      const cached = sessionStorage.getItem('anime_last_page');
      if (cached) {
        const cachedPage = Number(cached);
        if (Number.isFinite(cachedPage) && cachedPage > 0) {
          setCurrentPage(cachedPage);
        }
      }
    }
  }, [searchParams, setCurrentPage]);

  const pageSize = 12;
  const returnTo = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

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

  // ── SWR: 分页列表（cast/tag 筛选时暂停服务端分页，改用客户端过滤）────
  const swrPageKey = useMemo(() => {
    if (castQuery || tagFilter) return null;
    return animePageKey({
      page: currentPage,
      pageSize,
      status: filterStatus,
      search: debouncedSearch,
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

  // ── URL 筛选同步（仅首次） ───────────────────────────────────────────
  useEffect(() => {
    if (hasSyncedUrlFilters.current) return;

    const castFromUrl = searchParams.get('cast')?.trim();
    const tagFromUrl = searchParams.get('tag')?.trim();
    const statusFromUrl = searchParams.get('status')?.trim();

    if (castFromUrl) setCastQuery(castFromUrl);
    if (tagFromUrl) setTagFilter(tagFromUrl);
    if (statusFromUrl && ['watching', 'completed', 'dropped', 'plan_to_watch'].includes(statusFromUrl)) {
      setFilterStatus(statusFromUrl as AnimeStatus);
    }

    hasSyncedUrlFilters.current = true;
  }, [searchParams]);

  // ── 筛选变化 → 回到第 1 页 ───────────────────────────────────────────
  const filterStateKey = useMemo(
    () => [filterStatus, searchQuery, castQuery, tagFilter, sortBy, sortOrder].join('||'),
    [filterStatus, searchQuery, castQuery, tagFilter, sortBy, sortOrder],
  );

  useEffect(() => {
    if (!lastFilterKeyRef.current) {
      lastFilterKeyRef.current = filterStateKey;
      return;
    }
    if (lastFilterKeyRef.current === filterStateKey) return;
    lastFilterKeyRef.current = filterStateKey;
    if (currentPage !== 1) setCurrentPage(1);
  }, [currentPage, filterStateKey, setCurrentPage]);

  // ── 滚动位置恢复 ─────────────────────────────────────────────────────
  const loading = listLoading;
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
      tags: item.tags ? item.tags.join(', ') : '',
      durationMinutes: item.durationMinutes ? String(item.durationMinutes) : '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      isFinished: item.isFinished || false,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /** 表单保存/新建后的回调 — 刷新全量列表和当前分页 */
  const handleFormSaved = useCallback(() => {
    mutateAll();
    if (swrPageKey) globalMutate(swrPageKey);
  }, [mutateAll, swrPageKey]);

  const toggleViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    sessionStorage.setItem('anime_view_mode', mode);
  }, []);

  // ── 进度更新（乐观更新 + API） ──────────────────────────────────────
  const updateProgress = useCallback(async (id: number, current: number, total?: number | null) => {
    if (current < 0) return;
    const isFinishing = total && current >= total;
    const newStatus = isFinishing ? 'completed' : undefined;

    // 乐观更新函数
    const applyProgressPatch = (item: AnimeListItem): AnimeListItem => {
      if (item.id !== id) return item;
      const updated: AnimeListItem = { ...item, progress: current };
      if (newStatus) updated.status = newStatus;
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
      // 1) 乐观更新全量列表（侧边栏即时刷新）
      await mutateAll(
        (items) => items?.map(applyProgressPatch),
        { revalidate: false },
      );

      // 2) 乐观更新分页列表（网格即时刷新）
      if (swrPageKey) {
        await globalMutate(
          swrPageKey,
          (data: { records: AnimeListItem[]; total: number; page: number; totalPages: number } | undefined) => patchPageRecords(data, applyProgressPatch),
          { revalidate: false },
        );
      }

      // 3) 发送 API 请求
      const result = await fetchJson<{ ok: true; entry: AnimeListItem }>(`/api/anime/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress: current,
          status: newStatus,
          recordHistory: true,
        }),
      }, '更新失败，请重试');

      const serverPatch = applyServerEntry(result.entry);

      // 4) 先用服务端最终记录同步当前缓存，再后台重验证
      await mutateAll((items) => items?.map(serverPatch), { revalidate: false });
      if (swrPageKey) {
        await globalMutate(
          swrPageKey,
          (data: { records: AnimeListItem[]; total: number; page: number; totalPages: number } | undefined) => patchPageRecords(data, serverPatch),
          { revalidate: false },
        );
      }

      mutateAll();
      if (swrPageKey) globalMutate(swrPageKey);
      globalMutate(HISTORY_KEY);

      if (isFinishing) {
        toast.success('🎉 恭喜完结！');
      } else {
        toast.success(`已更新进度至 EP ${current}`);
      }
    } catch (err) {
      console.error('Update failed:', err);
      // 回滚：直接重验证
      mutateAll();
      if (swrPageKey) globalMutate(swrPageKey);
      globalMutate(HISTORY_KEY);
      toast.error(err instanceof Error ? err.message : '更新失败，请重试');
    }
  }, [mutateAll, swrPageKey]);

  // ── 删除操作 ─────────────────────────────────────────────────────────
  const deleteAnime = useCallback(async (id: number) => {
    const item = allItems.find(i => i.id === id);
    setDeleteConfirm({ id, title: item?.title || '这部番剧' });
  }, [allItems]);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await fetchJson<{ ok: true }>(`/api/anime/${id}`, { method: 'DELETE' }, '删除失败');
      resetForm();
      toast.success('已删除');
      // 全局重验证：全量列表 + 当前分页 + Dashboard
      globalMutate(ANIME_LIST_KEY);
      if (swrPageKey) globalMutate(swrPageKey);
      globalMutate(HISTORY_KEY);
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error(err instanceof Error ? err.message : '删除失败，请重试');
    }
  }, [deleteConfirm, resetForm, swrPageKey]);

  // ── AI 快捷录入 ─────────────────────────────────────────────────────
  const handleQuickRecord = useCallback(async () => {
    const text = quickInput.trim();
    if (!text) {
      setQuickMessage('请输入一句话记录');
      return;
    }

    setQuickLoading(true);
    setQuickMessage('');

    try {
      const data = await fetchJson<QuickRecordResponse>('/api/anime/quick-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }, 'AI录入失败');

      setQuickInput('');
      toast.success('AI 录入成功');
      setQuickMessage(buildQuickRecordMessage(data));
      // 刷新全量列表 + 当前分页
      mutateAll();
      if (swrPageKey) globalMutate(swrPageKey);
      globalMutate(HISTORY_KEY);
    } catch (error) {
      console.error('Quick record failed:', error);
      const message = error instanceof Error ? error.message : 'AI录入失败，请稍后重试';
      setQuickMessage(message);
      toast.error(message);
    } finally {
      setQuickLoading(false);
    }
  }, [quickInput, mutateAll, swrPageKey]);

  // ── 派生数据 ─────────────────────────────────────────────────────────
  const voiceActorSuggestions = useMemo(() => {
    return buildVoiceActorSuggestions(allItems);
  }, [allItems]);

  const tagPreferences = useMemo(() => {
    return buildTagPreferences(allItems);
  }, [allItems]);

  const toggleTagFilter = useCallback((tag: string) => {
    setTagFilter((current) => (current === tag ? '' : tag));
    if (currentPage !== 1) setCurrentPage(1);
  }, [currentPage, setCurrentPage]);

  const recentWatchItems = useMemo(() => {
    return buildRecentWatchItems(allItems);
  }, [allItems]);

  // ── 客户端筛选降级（cast/tag 筛选时使用） ────────────────────────────
  const filteredItems = useMemo(() => {
    if (!castQuery && !tagFilter) return [];
    return filterAndSortAnimeItems(allItems, {
      filterStatus,
      searchQuery,
      castQuery,
      tagFilter,
      sortBy,
      sortOrder,
    });
  }, [allItems, filterStatus, searchQuery, castQuery, tagFilter, sortBy, sortOrder]);

  const useServerPagination = !castQuery && !tagFilter;

  const displayTotalPages = useServerPagination
    ? totalPages
    : Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(currentPage, displayTotalPages);

  useEffect(() => {
    if (loading) return;
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
  }, [safePage, currentPage, loading, setCurrentPage]);

  const pagedItems = useMemo(() => {
    if (useServerPagination) return paginatedRecords;
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [useServerPagination, paginatedRecords, filteredItems, safePage, pageSize]);

  const displayTotal = useServerPagination ? totalCount : filteredItems.length;

  const rememberListScroll = useCallback(() => {
    sessionStorage.setItem(ANIME_LIST_SCROLL_KEY, String(window.scrollY));
  }, []);

  // ── 渲染 ─────────────────────────────────────────────────────────────
  return (
    <main className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 pb-20">
      <AnimeHeader
        showForm={showForm}
        editingId={editingId}
        setShowForm={setShowForm}
        resetForm={resetForm}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <AnimeQuickRecordPanel
          quickInput={quickInput}
          quickLoading={quickLoading}
          quickMessage={quickMessage}
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
              setFilterStatus={setFilterStatus}
              castQuery={castQuery}
              setCastQuery={setCastQuery}
              voiceActorSuggestions={voiceActorSuggestions}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              itemsCount={displayTotal}
            />

            {tagFilter && (
              <div className="flex items-center justify-between rounded-xl status-plan-soft px-3 py-2">
                <span className="text-xs text-[var(--color-plan)]">已按标签筛选：#{tagFilter}</span>
                <button
                  type="button"
                  onClick={() => setTagFilter('')}
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
            onEdit={startEdit}
            updateProgress={updateProgress}
            loading={loading || pageLoading}
            isAdmin={isAdmin}
            viewMode={viewMode}
            detailReturnTo={returnTo}
            onOpenDetail={rememberListScroll}
          />

          <AnimePagination
            loading={loading || pageLoading}
            itemsCount={displayTotal}
            currentPage={safePage}
            totalPages={displayTotalPages}
            onPageChange={setCurrentPage}
          />
        </div>

        <AnimeSidebar
          items={allItems}
          tagPreferences={tagPreferences}
          tagFilter={tagFilter}
          recentWatchItems={recentWatchItems}
          isAdmin={isAdmin}
          onToggleTagFilter={toggleTagFilter}
          onEdit={startEdit}
        />
      </div>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="删除番剧"
        message={`确定要删除「${deleteConfirm?.title || ''}」吗？删除后其观看历史也会一并清除，无法恢复。`}
        confirmText="确认删除"
        cancelText="再想想"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </main>
  );
}
