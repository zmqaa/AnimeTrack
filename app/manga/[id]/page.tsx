'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { ArrowTopRightOnSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import AsyncButton from '@/components/shared/AsyncButton';
import FormField from '@/components/shared/FormField';
import PageContainer from '@/components/shared/PageContainer';
import PageHero from '@/components/shared/PageHero';
import SegmentedControl from '@/components/shared/SegmentedControl';
import { fetchJson } from '@/lib/client-api';
import { useManageAccess } from '@/hooks/useManageAccess';
import {
  MANGA_PUBLICATION_STATUS_LABELS,
  MANGA_READING_STATUS_LABELS,
  type MangaPublicationStatus,
  type MangaReadingStatus,
  type MangaRecord,
} from '@/lib/manga-shared';

type Draft = {
  title: string;
  originalTitle: string;
  aliases: string;
  coverUrl: string;
  status: MangaReadingStatus;
  publicationStatus: MangaPublicationStatus;
  score: string;
  currentVolume: string;
  currentChapter: string;
  totalVolumes: string;
  totalChapters: string;
  notes: string;
  tags: string;
  summary: string;
  authors: string;
  illustrators: string;
  publishers: string;
  serializations: string;
  startDate: string;
  endDate: string;
  releaseDate: string;
};

const inputClass = 'w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70';

function joinValues(values: string[]) {
  return values.join('、');
}

function splitValues(value: string) {
  return Array.from(new Set(value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)));
}

function toDraft(record: MangaRecord): Draft {
  return {
    title: record.title,
    originalTitle: record.originalTitle || '',
    aliases: joinValues(record.aliases),
    coverUrl: record.coverUrl || '',
    status: record.status,
    publicationStatus: record.publicationStatus,
    score: record.score?.toString() || '',
    currentVolume: record.currentVolume || '',
    currentChapter: record.currentChapter || '',
    totalVolumes: record.totalVolumes?.toString() || '',
    totalChapters: record.totalChapters?.toString() || '',
    notes: record.notes || '',
    tags: joinValues(record.tags),
    summary: record.summary || '',
    authors: joinValues(record.authors),
    illustrators: joinValues(record.illustrators),
    publishers: joinValues(record.publishers),
    serializations: joinValues(record.serializations),
    startDate: record.startDate || '',
    endDate: record.endDate || '',
    releaseDate: record.releaseDate || '',
  };
}

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MangaDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { canManage } = useManageAccess();
  const { data: record, error, isLoading, mutate } = useSWR<MangaRecord>(
    `/api/manga/${params.id}`,
    (url: string) => fetchJson<MangaRecord>(url),
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (record) setDraft(toDraft(record));
  }, [record]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!draft || !record) return;
    if (!draft.title.trim()) return toast.error('标题不能为空');
    setIsSaving(true);
    try {
      const response = await fetchJson<{ ok: true; entry: MangaRecord }>(`/api/manga/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          originalTitle: draft.originalTitle.trim() || null,
          aliases: splitValues(draft.aliases),
          coverUrl: draft.coverUrl.trim() || null,
          status: draft.status,
          publicationStatus: draft.publicationStatus,
          score: optionalNumber(draft.score),
          currentVolume: draft.currentVolume.trim() || null,
          currentChapter: draft.currentChapter.trim() || null,
          totalVolumes: optionalNumber(draft.totalVolumes),
          totalChapters: optionalNumber(draft.totalChapters),
          notes: draft.notes.trim() || null,
          tags: splitValues(draft.tags),
          summary: draft.summary.trim() || null,
          authors: splitValues(draft.authors),
          illustrators: splitValues(draft.illustrators),
          publishers: splitValues(draft.publishers),
          serializations: splitValues(draft.serializations),
          startDate: draft.startDate || null,
          endDate: draft.endDate || null,
          releaseDate: draft.releaseDate || null,
        }),
      }, '保存漫画失败');
      await mutate(response.entry, false);
      setDraft(toDraft(response.entry));
      toast.success('漫画记录已保存');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : '保存漫画失败');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!record || !window.confirm(`确定删除《${record.title}》吗？此操作不可撤销。`)) return;
    setIsDeleting(true);
    try {
      await fetchJson(`/api/manga/${record.id}`, { method: 'DELETE' }, '删除漫画失败');
      toast.success('漫画记录已删除');
      router.push('/manga');
      router.refresh();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : '删除漫画失败');
      setIsDeleting(false);
    }
  };

  if (isLoading || (!record && !error)) {
    return <PageContainer as="main"><div className="py-24 text-center text-[var(--text-muted)]">正在打开漫画档案…</div></PageContainer>;
  }
  if (error || !record || !draft) {
    return <PageContainer as="main"><div className="surface-card rounded-3xl p-10 text-center text-[var(--text-muted)]">漫画不存在或暂时无法读取。</div></PageContainer>;
  }

  return (
    <PageContainer as="main" width="content">
      <PageHero
        className="glass-panel-strong"
        title={record.title}
        description={record.originalTitle || '漫画阅读档案'}
        backHref="/manga"
        backLabel="返回漫画书架"
        actions={(
          <>
            {record.bangumiId ? (
              <a href={`https://bgm.tv/subject/${record.bangumiId}`} target="_blank" rel="noreferrer" className="surface-pill inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-[var(--text-secondary)]">
                Bangumi #{record.bangumiId}<ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            ) : null}
            {canManage ? (
              <>
                <AsyncButton onClick={remove} busy={isDeleting} busyLabel="删除中…" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)]/10">
                  <TrashIcon className="h-4 w-4" />删除
                </AsyncButton>
                <AsyncButton onClick={save} busy={isSaving} busyLabel="保存中…" className="theme-accent-button rounded-xl px-5 py-2.5 text-sm font-medium shadow-theme-md">
                  保存修改
                </AsyncButton>
              </>
            ) : null}
          </>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="surface-card overflow-hidden rounded-[28px] p-4">
            <div className="aspect-[3/4] overflow-hidden rounded-[22px] bg-[var(--bg-card)]">
              {draft.coverUrl ? (
                <div
                  role="img"
                  aria-label={`${draft.title}封面`}
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${draft.coverUrl})` }}
                />
              ) : <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">暂无封面</div>}
            </div>
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-center text-sm font-semibold tracking-[0.16em] ${draft.status === 'completed' ? 'status-completed-soft' : draft.status === 'dropped' ? 'status-dropped-soft' : draft.status === 'plan_to_read' ? 'status-plan-soft' : 'status-watching-soft'}`}>
              {MANGA_READING_STATUS_LABELS[draft.status]}
            </div>
          </div>
          <div className="surface-card space-y-3 rounded-[24px] p-5 text-sm">
            <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">阅读状态</span><span className="text-[var(--text-primary)]">{MANGA_READING_STATUS_LABELS[draft.status]}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">作品状态</span><span className="text-[var(--text-primary)]">{MANGA_PUBLICATION_STATUS_LABELS[draft.publicationStatus]}</span></div>
            <div className="flex justify-between gap-4"><span className="text-[var(--text-muted)]">阅读位置</span><span className="text-right text-[var(--text-primary)]">{draft.currentChapter ? `第 ${draft.currentChapter} 话` : draft.currentVolume ? `第 ${draft.currentVolume} 卷` : '未记录'}</span></div>
          </div>
        </aside>

        <section className="surface-card space-y-8 rounded-[28px] p-5 md:p-7">
          <div>
            <h2 className="text-lg font-medium text-[var(--text-primary)]">我的阅读</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">卷数和话数均可留空；“已追到最新”不会写入读完日期。</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="阅读状态" className="md:col-span-2" hint="连载作品读完现有内容时，选择“追到最新”而不是“已读完”。">
              <SegmentedControl
                value={draft.status}
                options={(Object.entries(MANGA_READING_STATUS_LABELS) as Array<[MangaReadingStatus, string]>).map(([value, label]) => ({ value, label }))}
                onChange={(value) => update('status', value)}
                ariaLabel="阅读状态"
                className={`max-w-full overflow-x-auto no-scrollbar ${!canManage ? 'pointer-events-none opacity-70' : ''}`}
                buttonClassName="px-4 py-2 text-sm font-medium"
                activeClassName="theme-accent-text"
              />
            </FormField>
            <FormField label="作品连载状态" className="md:col-span-2">
              <SegmentedControl
                value={draft.publicationStatus}
                options={(Object.entries(MANGA_PUBLICATION_STATUS_LABELS) as Array<[MangaPublicationStatus, string]>).map(([value, label]) => ({ value, label }))}
                onChange={(value) => update('publicationStatus', value)}
                ariaLabel="作品连载状态"
                className={`max-w-full overflow-x-auto no-scrollbar ${!canManage ? 'pointer-events-none opacity-70' : ''}`}
                buttonClassName="px-4 py-2 text-sm font-medium"
                activeClassName="theme-accent-text"
              />
            </FormField>
            <FormField label="当前卷" hint="例如 5；没有分卷时留空">
              <input disabled={!canManage} value={draft.currentVolume} onChange={(event) => update('currentVolume', event.target.value)} className={inputClass} placeholder="未记录" />
            </FormField>
            <FormField label="当前话" hint="支持 42.5、番外 3 等写法">
              <input disabled={!canManage} value={draft.currentChapter} onChange={(event) => update('currentChapter', event.target.value)} className={inputClass} placeholder="未记录" />
            </FormField>
            <FormField label="开始日期">
              <input disabled={!canManage} type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} className={inputClass} />
            </FormField>
            <FormField label="读完日期">
              <input disabled={!canManage} type="date" value={draft.endDate} onChange={(event) => update('endDate', event.target.value)} className={inputClass} />
            </FormField>
            <FormField label="个人评分" hint="0～10 分，可留空">
              <input disabled={!canManage} type="number" min="0" max="10" step="0.1" value={draft.score} onChange={(event) => update('score', event.target.value)} className={inputClass} placeholder="未评分" />
            </FormField>
            <FormField label="标签" hint="使用顿号或逗号分隔">
              <input disabled={!canManage} value={draft.tags} onChange={(event) => update('tags', event.target.value)} className={inputClass} placeholder="百合、日常" />
            </FormField>
          </div>

          <div className="border-t border-[var(--border)] pt-8">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">作品资料</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="标题" required><input disabled={!canManage} value={draft.title} onChange={(event) => update('title', event.target.value)} className={inputClass} /></FormField>
            <FormField label="原名"><input disabled={!canManage} value={draft.originalTitle} onChange={(event) => update('originalTitle', event.target.value)} className={inputClass} /></FormField>
            <FormField label="作者"><input disabled={!canManage} value={draft.authors} onChange={(event) => update('authors', event.target.value)} className={inputClass} /></FormField>
            <FormField label="作画"><input disabled={!canManage} value={draft.illustrators} onChange={(event) => update('illustrators', event.target.value)} className={inputClass} /></FormField>
            <FormField label="出版社"><input disabled={!canManage} value={draft.publishers} onChange={(event) => update('publishers', event.target.value)} className={inputClass} /></FormField>
            <FormField label="连载杂志或平台"><input disabled={!canManage} value={draft.serializations} onChange={(event) => update('serializations', event.target.value)} className={inputClass} /></FormField>
            <FormField label="参考卷数"><input disabled={!canManage} type="number" min="0" value={draft.totalVolumes} onChange={(event) => update('totalVolumes', event.target.value)} className={inputClass} /></FormField>
            <FormField label="参考话数"><input disabled={!canManage} type="number" min="0" value={draft.totalChapters} onChange={(event) => update('totalChapters', event.target.value)} className={inputClass} /></FormField>
            <FormField label="发行日期"><input disabled={!canManage} type="date" value={draft.releaseDate} onChange={(event) => update('releaseDate', event.target.value)} className={inputClass} /></FormField>
            <FormField label="别名"><input disabled={!canManage} value={draft.aliases} onChange={(event) => update('aliases', event.target.value)} className={inputClass} /></FormField>
            <FormField label="封面地址" className="md:col-span-2"><input disabled={!canManage} value={draft.coverUrl} onChange={(event) => update('coverUrl', event.target.value)} className={inputClass} /></FormField>
            <FormField label="简介" className="md:col-span-2"><textarea disabled={!canManage} value={draft.summary} onChange={(event) => update('summary', event.target.value)} className={`${inputClass} min-h-32 resize-y`} /></FormField>
            <FormField label="阅读笔记" className="md:col-span-2"><textarea disabled={!canManage} value={draft.notes} onChange={(event) => update('notes', event.target.value)} className={`${inputClass} min-h-40 resize-y`} placeholder="记录对这部漫画的整体感受…" /></FormField>
          </div>

        </section>
      </div>
    </PageContainer>
  );
}
