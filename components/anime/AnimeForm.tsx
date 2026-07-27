"use client";

import { useState } from 'react';
import toast from 'react-hot-toast';
import { fetchJson } from '@/lib/client-api';
import type { AnimeStatus, AnimeFormInitialData } from '@/lib/anime-shared';
import { statusLabels } from '@/lib/dashboard-types';
import FormField from '@/components/shared/FormField';
import AsyncButton from '@/components/shared/AsyncButton';
import NumericInput from '@/components/shared/NumericInput';

interface AnimeFormProps {
  editingId: number | null;
        initialData: AnimeFormInitialData;
  resetForm: () => void;
  onSaved: () => void;
  deleteAnime: (id: number) => Promise<void>;
}

export default function AnimeForm({
  editingId,
  initialData,
  resetForm,
  onSaved,
  deleteAnime
}: AnimeFormProps) {
  const [title, setTitle] = useState(initialData.title || '');
  const [originalTitle, setOriginalTitle] = useState(initialData.originalTitle || '');
  const [progress, setProgress] = useState(initialData.progress || '0');
  const [totalEpisodes, setTotalEpisodes] = useState(initialData.totalEpisodes || '');
  const [status, setStatus] = useState<AnimeStatus>(initialData.status || 'watching');
  const [notes, setNotes] = useState(initialData.notes || '');
  const [coverUrl, setCoverUrl] = useState(initialData.coverUrl || '');
  const [tagsInput, setTagsInput] = useState(initialData.tags || '');
  const [durationMinutes, setDurationMinutes] = useState(initialData.durationMinutes || '');
  const [startDate, setStartDate] = useState(initialData.startDate || '');
  const [endDate, setEndDate] = useState(initialData.endDate || '');
  const [isFinished, setIsFinished] = useState(initialData.isFinished || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || isSubmitting) return;

    setIsSubmitting(true);
    try {
            const payload: Record<string, unknown> = {
        title,
        originalTitle,
        progress: Number(progress),
        totalEpisodes: totalEpisodes ? Number(totalEpisodes) : undefined,
        status,
        notes,
        coverUrl: coverUrl || undefined,
        tags: tagsInput.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean),
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        isFinished: Boolean(isFinished),
      };

      const url = editingId ? `/api/anime/${editingId}` : '/api/anime';
      const method = editingId ? 'PATCH' : 'POST';

            await fetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
            }, '操作失败');
            onSaved();
            resetForm();
            toast.success(editingId ? '已保存' : '已添加');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="surface-card p-6 rounded-2xl mb-8 animate-in fade-in slide-in-from-top-4 shadow-lg ring-1 ring-[var(--border)]">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">{editingId ? '编辑番剧' : '新番入库'}</h2>
          <button type="button" onClick={resetForm} disabled={isSubmitting} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50">取消</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 mb-6">
        <div className="lg:col-span-6 space-y-4">
            <FormField label="番剧名称" required>
                <input 
                    value={title} onChange={e => setTitle(e.target.value)}
                    className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition text-[var(--text-primary)]"
                    placeholder="例如：葬送的芙莉莲"
                />
            </FormField>
            <FormField label="原名 (可选)">
                 <input 
                     value={originalTitle} onChange={e => setOriginalTitle(e.target.value)}
                     className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition font-sans text-sm text-[var(--text-primary)]"
                 />
            </FormField>
            <FormField label="封面链接 (可选)">
               <div className="flex gap-2">
                   <input 
                       value={coverUrl} onChange={e => setCoverUrl(e.target.value)}
                       className="surface-input flex-1 rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition text-sm font-mono text-[var(--text-primary)]"
                   />
                   {(coverUrl || initialData.displayCoverUrl) && (
                       <div className="surface-card-muted w-10 h-11 rounded-md overflow-hidden shrink-0">
                           {/* eslint-disable-next-line @next/next/no-img-element */}
                           <img key={coverUrl || initialData.displayCoverUrl} src={coverUrl || initialData.displayCoverUrl} alt="Cover" className="w-full h-full object-cover" />
                       </div>
                   )}
               </div>
            </FormField>
            <FormField label="标签 (逗号分隔)">
                <input 
                    value={tagsInput} onChange={e => setTagsInput(e.target.value)}
                    className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition text-[var(--text-primary)]"
                />
            </FormField>
        </div>

        <div className="lg:col-span-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField label="当前进度">
                    <NumericInput
                        min={0} value={progress} onValueChange={setProgress}
                        className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition text-[var(--text-primary)]"
                    />
                </FormField>
                <FormField label="总集数">
                    <NumericInput
                        min={1} max={9999} value={totalEpisodes} onValueChange={setTotalEpisodes}
                        placeholder="未知"
                        className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition text-[var(--text-primary)]"
                    />
                </FormField>
            </div>
             <div className="grid grid-cols-2 gap-4">
                <FormField label="单集时长 (分)">
                     <NumericInput
                         min={1} max={9999} value={durationMinutes} onValueChange={setDurationMinutes}
                         placeholder="24"
                         className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition text-[var(--text-primary)]"
                     />
                </FormField>
                 <FormField label="状态">
                    <select 
                        value={status} onChange={e => setStatus(e.target.value as AnimeStatus)}
                        className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition appearance-none text-[var(--text-primary)]"
                    >
                        {Object.entries(statusLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <FormField label="开始观看日期">
                     <input 
                         type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                         className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition text-[var(--text-primary)]"
                     />
                </FormField>
                <FormField label="看完日期">
                     <input 
                         type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                         className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition text-[var(--text-primary)]"
                     />
                </FormField>
            </div>

            <div className="flex items-center gap-3 py-2">
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" checked={isFinished} onChange={e => setIsFinished(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--tag-bg)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-[var(--text-primary)] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-[var(--text-primary)] after:border-[var(--border)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
                </label>
                <span className="text-xs font-medium text-[var(--text-muted)]">番剧已完结 (不再更新)</span>
            </div>

            <FormField label="备注 (AI自动补全简介)">
                <textarea 
                    value={notes} onChange={e => setNotes(e.target.value)}
                    className="surface-input w-full rounded-lg px-3 py-2.5 focus-theme focus:outline-none transition min-h-[80px] text-[var(--text-primary)]"
                    rows={3}
                />
            </FormField>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
         {editingId && (
             <button type="button" onClick={() => deleteAnime(editingId)} disabled={isSubmitting} className="px-4 py-2 hover:bg-[var(--color-danger-bg)] text-danger rounded-lg text-sm mr-auto disabled:cursor-not-allowed disabled:opacity-50">删除此番剧</button>
         )}
        <button type="button" onClick={resetForm} disabled={isSubmitting} className="px-4 py-2 hover:bg-[var(--color-surface-hover)] rounded-lg transition text-sm text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-50">取消</button>
        <AsyncButton
          type="submit"
          busy={isSubmitting}
          busyLabel={editingId ? '正在保存…' : '正在添加…'}
          className="px-6 py-2 bg-[var(--text-primary)] text-[var(--bg-page)] rounded-lg hover:opacity-90 transition text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {editingId ? '保存修改' : '立即添加'}
        </AsyncButton>
      </div>
    </form>
  );
}
