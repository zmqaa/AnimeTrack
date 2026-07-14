"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { fetchJson } from '@/lib/client-api';
import type { AnimeStatus, AnimeDetailItem, SessionUser } from '@/lib/anime-shared';
import {
  buildChangedPayload, resolveReturnTo, updateAnimeListCache, removeAnimeFromListCache,
  type AnimeMutationResponse,
} from './anime-detail-helpers';
import AnimeDetailSidebar from './AnimeDetailSidebar';
import AnimeDetailMain from './AnimeDetailMain';

export default function AnimeDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = (session?.user as SessionUser | undefined)?.role === 'admin';
  const [item, setItem] = useState<AnimeDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<AnimeDetailItem>>({});
  const [isAiEnriching, setIsAiEnriching] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const returnTo = useMemo(() => resolveReturnTo(searchParams.get('returnTo')), [searchParams]);
  const canEdit = isAdmin && isEditing;

  useEffect(() => {
    if (!isAdmin) setIsEditing(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchJson<AnimeDetailItem>(`/api/anime/${params.id}`, undefined, 'Not found')
      .then((data) => { setItem(data); setFormData(data); })
      .catch(() => router.push(returnTo))
      .finally(() => setLoading(false));
  }, [params.id, returnTo, router]);

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
      setItem(response.entry);
      setFormData(response.entry);
      updateAnimeListCache(response.entry);
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
      setItem(response.entry);
      setFormData(response.entry);
      updateAnimeListCache(response.entry);
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
      removeAnimeFromListCache(Number(params.id));
      toast.success('已删除');
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

  if (loading) return <div className="p-12 text-center text-[var(--text-muted)]">Loading details...</div>;
  if (!item) return null;

  return (
    <div className="mx-auto w-full max-w-[1660px] px-4 md:px-6 xl:px-8 2xl:px-10 pb-20 animate-in fade-in zoom-in-95 duration-300">
      <div className="relative overflow-hidden rounded-[32px] border border-[var(--border)] shadow-[0_30px_80px_rgba(0,0,0,0.45)]" style={{ backgroundColor: 'var(--bg-card)' }}>
        {/* Background blur from cover */}
        {(typeof formData.coverUrl === 'string' ? formData.coverUrl : item.coverUrl) && (
          <div className="absolute inset-0 opacity-[0.08]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={formData.coverUrl as string || item.coverUrl || ''} alt={item.title} className="h-full w-full scale-110 object-cover blur-3xl" />
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
    </div>
  );
}
