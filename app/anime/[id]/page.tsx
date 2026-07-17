"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { fetchJson } from '@/lib/client-api';
import type { AnimeStatus, AnimeDetailItem } from '@/lib/anime-shared';
import { useRuntimeAccess } from '@/hooks/useRuntimeAccess';
import { ANIME_LIST_KEY, HISTORY_KEY, animeDetailKey, swrFetcher } from '@/lib/swr-config';
import {
  buildChangedPayload, resolveReturnTo,
  type AnimeMutationResponse,
} from './anime-detail-helpers';
import AnimeDetailSidebar from './AnimeDetailSidebar';
import AnimeDetailMain from './AnimeDetailMain';
import PageContainer from '@/components/shared/PageContainer';

export default function AnimeDetailPage({ params }: { params: { id: string } }) {
  const { canManage: isAdmin } = useRuntimeAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAiEnriching, setIsAiEnriching] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const returnTo = useMemo(() => resolveReturnTo(searchParams.get('returnTo')), [searchParams]);
  const canEdit = isAdmin && isEditing;

  // SWR 加载详情数据
  const { data: item, isLoading, error, mutate } = useSWR<AnimeDetailItem>(
    animeDetailKey(params.id),
    swrFetcher,
  );

  // 加载失败时跳回列表
  useEffect(() => {
    if (error) router.push(returnTo);
  }, [error, returnTo, router]);

  // 表单编辑副本（与 SWR 缓存分离）
  const [formData, setFormData] = useState<Partial<AnimeDetailItem>>({});

  // 数据就绪后初始化表单
  useEffect(() => {
    if (item) setFormData(item);
  }, [item]);

  useEffect(() => {
    if (!isAdmin) setIsEditing(false);
  }, [isAdmin]);

  const handleChange = (key: keyof AnimeDetailItem, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const saveChanges = async () => {
    if (!item || !isAdmin) return;
    const payload = buildChangedPayload(formData, item);
    if (Object.keys(payload).length === 0) {
      toast('没有需要保存的变更', { icon: 'ℹ️' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetchJson<AnimeMutationResponse>(`/api/anime/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, '保存失败');
      // 更新当前详情缓存
      mutate(response.entry, { revalidate: false });
      setFormData(response.entry);
      // 全局刷新番剧列表（侧边栏、Dashboard 等自动同步）
      globalMutate(ANIME_LIST_KEY);
      setIsEditing(false);
      toast.success('保存成功');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存出错');
    } finally { setSaving(false); }
  };

  const enrichAnimeInfo = async () => {
    if (!isAdmin) return;
    setIsAiEnriching(true);
    try {
      const response = await fetchJson<AnimeMutationResponse>(`/api/anime/${params.id}/enrich`, { method: 'POST' }, 'AI补充失败');
      mutate(response.entry, { revalidate: false });
      setFormData(response.entry);
      globalMutate(ANIME_LIST_KEY);
      const appliedCount = Array.isArray(response.appliedFields) ? response.appliedFields.length : 0;
      if (appliedCount === 0) toast('没有可补充的空缺字段', { icon: 'ℹ️' });
      else toast.success(`已补充 ${appliedCount} 个字段`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI补充失败');
    } finally { setIsAiEnriching(false); }
  };

  const confirmDelete = async () => {
    setShowDeleteConfirm(false);
    try {
      await fetchJson<{ ok: true }>(`/api/anime/${params.id}`, { method: 'DELETE' }, '删除失败');
      toast.success('已删除');
      // 全局刷新番剧列表
      globalMutate(ANIME_LIST_KEY);
      globalMutate(HISTORY_KEY);
      router.push(returnTo, { scroll: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  // Display values derived from formData/current item
  const displayStatus = ((formData.status ?? item?.status ?? 'watching') as AnimeStatus);
  const displayProgress = Number(formData.progress ?? item?.progress ?? 0) || 0;
  const displayTotalEpisodes = Number(formData.totalEpisodes ?? item?.totalEpisodes ?? 0) || undefined;
  const displayDuration = Number(formData.durationMinutes ?? item?.durationMinutes ?? 0) || undefined;
  const displayScoreValue: unknown = formData.score ?? item?.score;
  const displayScore = (displayScoreValue === undefined || displayScoreValue === '' || displayScoreValue === null) ? undefined : Number(displayScoreValue);
  const displayTags = Array.isArray(item?.tags) ? item.tags : [];
  const progressPercent = displayTotalEpisodes && displayTotalEpisodes > 0
    ? Math.min(100, (displayProgress / displayTotalEpisodes) * 100)
    : (displayStatus === 'completed' ? 100 : Math.min(displayProgress * 8, 100));

  if (isLoading) {
    return (
      <PageContainer width="wide" spacing="compact" animation="none">
        <div className="text-center text-[var(--text-muted)]">Loading details...</div>
      </PageContainer>
    );
  }
  if (!item) return null;

  return (
    <PageContainer width="wide" spacing="detail" animation="zoom">
      <div className="shadow-theme-xl relative overflow-hidden rounded-[32px] border border-[var(--border)]" style={{ backgroundColor: 'var(--bg-card)' }}>
        {/* Background blur from cover */}
        {((typeof formData.coverUrl === 'string' ? formData.coverUrl : undefined) || item.displayCoverUrl) && (
          <div className="absolute inset-0 opacity-[0.08]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={(formData.coverUrl as string) || item.displayCoverUrl || ''} alt={item.title} className="h-full w-full scale-110 object-cover blur-3xl" />
          </div>
        )}
        <div className="theme-detail-aura absolute inset-0" />

        <div className="relative p-5 md:p-8 xl:p-10 2xl:p-12">
          <button onClick={() => router.push(returnTo, { scroll: false })} className="flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] mb-6">
            <ArrowLeftIcon className="h-4 w-4" />
            <span>返回列表</span>
          </button>

          <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[390px_minmax(0,1fr)] 2xl:gap-10">
            <AnimeDetailSidebar
              item={item}
              canEdit={canEdit}
              formData={formData}
              displayStatus={displayStatus}
              displayScore={displayScore}
              displayTotalEpisodes={displayTotalEpisodes}
              displayDuration={displayDuration}
              onChange={handleChange}
            />
            <AnimeDetailMain
              item={item}
              isAdmin={isAdmin}
              canEdit={canEdit}
              saving={saving}
              isAiEnriching={isAiEnriching}
              formData={formData}
              displayStatus={displayStatus}
              displayProgress={displayProgress}
              displayTotalEpisodes={displayTotalEpisodes}
              displayDuration={displayDuration}
              displayTags={displayTags}
              progressPercent={progressPercent}
              onChange={handleChange}
              onEdit={() => setIsEditing(true)}
              onCancel={() => { setIsEditing(false); setFormData(item); }}
              onSave={saveChanges}
              onEnrich={enrichAnimeInfo}
              onDelete={() => setShowDeleteConfirm(true)}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除番剧"
        message={`确定要删除「${item.title}」吗？删除后其观看历史也会一并清除，无法恢复。`}
        confirmText="确认删除"
        cancelText="再想想"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </PageContainer>
  );
}
