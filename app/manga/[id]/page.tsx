'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PageContainer from '@/components/shared/PageContainer';
import { fetchJson } from '@/lib/client-api';
import { useManageAccess } from '@/hooks/useManageAccess';
import type { MangaRecord } from '@/lib/manga-shared';
import MangaDetailMain from './MangaDetailMain';
import MangaDetailSidebar from './MangaDetailSidebar';
import {
  optionalMangaNumber,
  splitMangaValues,
  toMangaDetailDraft,
  type MangaDetailDraft,
} from './manga-detail-helpers';

export default function MangaDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { canManage: isAdmin } = useManageAccess();
  const { data: record, error, isLoading, mutate } = useSWR<MangaRecord>(
    `/api/manga/${params.id}`,
    (url: string) => fetchJson<MangaRecord>(url),
  );
  const [draft, setDraft] = useState<MangaDetailDraft | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const canEdit = isAdmin && isEditing;

  useEffect(() => {
    if (record) setDraft(toMangaDetailDraft(record));
  }, [record]);

  useEffect(() => {
    if (!isAdmin) setIsEditing(false);
  }, [isAdmin]);

  const update = <K extends keyof MangaDetailDraft>(key: K, value: MangaDetailDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!draft || !record || !isAdmin) return;
    if (!draft.title.trim()) return toast.error('标题不能为空');
    setIsSaving(true);
    try {
      const response = await fetchJson<{ ok: true; entry: MangaRecord }>(`/api/manga/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          originalTitle: draft.originalTitle.trim() || null,
          aliases: splitMangaValues(draft.aliases),
          coverUrl: draft.coverUrl.trim() || null,
          status: draft.status,
          publicationStatus: draft.publicationStatus,
          score: optionalMangaNumber(draft.score),
          currentVolume: draft.currentVolume.trim() || null,
          currentChapter: draft.currentChapter.trim() || null,
          totalVolumes: optionalMangaNumber(draft.totalVolumes),
          totalChapters: optionalMangaNumber(draft.totalChapters),
          notes: draft.notes.trim() || null,
          tags: splitMangaValues(draft.tags),
          summary: draft.summary.trim() || null,
          authors: splitMangaValues(draft.authors),
          illustrators: splitMangaValues(draft.illustrators),
          publishers: splitMangaValues(draft.publishers),
          serializations: splitMangaValues(draft.serializations),
          startDate: draft.startDate || null,
          endDate: draft.endDate || null,
          releaseDate: draft.releaseDate || null,
        }),
      }, '保存漫画失败');
      await mutate(response.entry, false);
      setDraft(toMangaDetailDraft(response.entry));
      globalMutate('/api/manga');
      setIsEditing(false);
      toast.success('保存成功');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : '保存漫画失败');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!record || isDeleting) return;
    setIsDeleting(true);
    try {
      await fetchJson(`/api/manga/${record.id}`, { method: 'DELETE' }, '删除漫画失败');
      globalMutate('/api/manga');
      toast.success('漫画记录已删除');
      router.push('/manga');
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : '删除漫画失败');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const refreshMetadata = async () => {
    if (!record?.bangumiId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const response = await fetchJson<{ ok: true; appliedFields: string[]; entry: MangaRecord }>(
        `/api/manga/${record.id}/enrich`,
        { method: 'POST' },
        '更新漫画资料失败',
      );
      await mutate(response.entry, false);
      setDraft(toMangaDetailDraft(response.entry));
      globalMutate('/api/manga');
      toast.success(response.appliedFields.length > 0 ? '漫画资料已更新' : '漫画资料已经是最新状态');
    } catch (refreshError) {
      toast.error(refreshError instanceof Error ? refreshError.message : '更新漫画资料失败');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading || (!record && !error)) {
    return <PageContainer as="main"><div className="py-24 text-center text-[var(--text-muted)]">正在打开漫画档案…</div></PageContainer>;
  }
  if (error || !record || !draft) {
    return <PageContainer as="main"><div className="surface-card rounded-3xl p-10 text-center text-[var(--text-muted)]">漫画不存在或暂时无法读取。</div></PageContainer>;
  }

  return (
    <PageContainer as="main" width="wide" spacing="detail" animation="zoom">
      <div className="shadow-theme-xl relative overflow-hidden rounded-[32px] border border-[var(--border)]" style={{ backgroundColor: 'var(--bg-card)' }}>
        {draft.coverUrl ? (
          <div className="absolute inset-0 opacity-[0.08]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.coverUrl} alt={record.title} className="h-full w-full scale-110 object-cover blur-3xl" />
          </div>
        ) : null}
        <div className="theme-detail-aura absolute inset-0" />

        <div className="relative p-5 md:p-8 xl:p-10 2xl:p-12">
          <button onClick={() => router.push('/manga')} className="mb-6 flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
            <ArrowLeftIcon className="h-4 w-4" />
            <span>返回列表</span>
          </button>

          <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[390px_minmax(0,1fr)] 2xl:gap-10">
            <MangaDetailSidebar record={record} draft={draft} canEdit={canEdit} onChange={update} />
            <MangaDetailMain
              record={record}
              draft={draft}
              isAdmin={isAdmin}
              canEdit={canEdit}
              saving={isSaving}
              isRefreshing={isRefreshing}
              onChange={update}
              onEdit={() => setIsEditing(true)}
              onCancel={() => {
                setIsEditing(false);
                setDraft(toMangaDetailDraft(record));
              }}
              onSave={save}
              onRefresh={refreshMetadata}
              onDelete={() => setShowDeleteConfirm(true)}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="删除漫画"
        message={`确定要删除「${record.title}」吗？删除后无法恢复。`}
        confirmText={isDeleting ? '正在删除…' : '确认删除'}
        cancelText="再想想"
        variant="danger"
        busy={isDeleting}
        onConfirm={remove}
        onCancel={() => !isDeleting && setShowDeleteConfirm(false)}
      />
    </PageContainer>
  );
}
