"use client";

import { useEffect, useMemo, useState } from 'react';
import { ClockIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import AsyncButton from '@/components/shared/AsyncButton';
import SectionTitle from '@/components/shared/SectionTitle';
import { fetchJson } from '@/lib/client-api';
import type { AnimeNoteEntry } from '@/lib/anime-shared';

type NoteDraft = {
  episode: string;
  notedAt: string;
  content: string;
};

type Props = {
  animeId: number;
  overallNote?: string;
  noteEntries?: AnimeNoteEntry[];
  currentEpisode: number;
  isAdmin: boolean;
  canEditOverall: boolean;
  overallDraft?: string;
  onOverallChange: (value: string) => void;
  onNotesChanged: () => Promise<unknown>;
};

function todayDateKey() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function emptyDraft(currentEpisode: number): NoteDraft {
  return {
    episode: String(Math.max(1, currentEpisode || 1)),
    notedAt: todayDateKey(),
    content: '',
  };
}

function noteDraft(note: AnimeNoteEntry): NoteDraft {
  return {
    episode: String(note.episode || 1),
    notedAt: note.notedAt,
    content: note.content,
  };
}

export default function AnimeNotesPanel({
  animeId,
  overallNote,
  noteEntries,
  currentEpisode,
  isAdmin,
  canEditOverall,
  overallDraft,
  onOverallChange,
  onNotesChanged,
}: Props) {
  const episodeNotes = useMemo(
    () => (noteEntries || []).filter((note) => note.episode !== undefined),
    [noteEntries],
  );
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<NoteDraft>(() => emptyDraft(currentEpisode));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const canManageEpisodeNotes = isAdmin && !canEditOverall;

  useEffect(() => {
    if (canEditOverall) {
      setAdding(false);
      setEditingId(null);
      setDeletingId(null);
    }
  }, [canEditOverall]);

  const resetComposer = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyDraft(currentEpisode));
  };

  const submitNote = async () => {
    const episode = Number(draft.episode);
    if (!Number.isInteger(episode) || episode < 1) {
      toast.error('请输入有效集数');
      return;
    }
    if (!draft.content.trim()) {
      toast.error('请输入备注内容');
      return;
    }

    setSaving(true);
    try {
      const url = editingId
        ? `/api/anime/${animeId}/notes/${editingId}`
        : `/api/anime/${animeId}/notes`;
      await fetchJson<AnimeNoteEntry>(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episode,
          notedAt: draft.notedAt,
          content: draft.content,
        }),
      }, editingId ? '更新备注失败' : '新增备注失败');
      await onNotesChanged();
      toast.success(editingId ? '备注已更新' : '备注已添加');
      resetComposer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存备注失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (noteId: number) => {
    setSaving(true);
    try {
      await fetchJson<{ ok: true }>(`/api/anime/${animeId}/notes/${noteId}`, {
        method: 'DELETE',
      }, '删除备注失败');
      await onNotesChanged();
      toast.success('备注已删除');
      setDeletingId(null);
      if (editingId === noteId) resetComposer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除备注失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
      <SectionTitle
        size="small"
        icon={<ClockIcon className="h-4 w-4" />}
        action={canManageEpisodeNotes && !adding && editingId === null ? (
          <button
            type="button"
            onClick={() => {
              setDraft(emptyDraft(currentEpisode));
              setAdding(true);
            }}
            className="theme-accent-soft flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition"
          >
            <PlusIcon className="h-4 w-4" />
            添加分集备注
          </button>
        ) : undefined}
      >
        个人备注
      </SectionTitle>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">总备注</p>
        {canEditOverall ? (
          <textarea
            rows={4}
            value={overallDraft || ''}
            onChange={(event) => onOverallChange(event.target.value)}
            placeholder="记录对整部作品的总体印象"
            className="surface-input theme-focus-accent w-full rounded-2xl p-4 text-sm leading-7 text-[var(--text-primary)] transition"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
            {overallNote || '还没有留下总体备注。'}
          </p>
        )}
      </div>

      {canManageEpisodeNotes && (adding || editingId !== null) && (
        <div className="surface-card-muted mt-5 rounded-2xl p-4">
          <div className="grid gap-3 sm:grid-cols-[110px_150px_minmax(0,1fr)]">
            <label className="text-xs text-[var(--text-muted)]">
              集数
              <input
                type="number"
                min={1}
                value={draft.episode}
                onChange={(event) => setDraft((current) => ({ ...current, episode: event.target.value }))}
                className="surface-input theme-focus-accent mt-1.5 w-full rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              日期
              <input
                type="date"
                value={draft.notedAt}
                onChange={(event) => setDraft((current) => ({ ...current, notedAt: event.target.value }))}
                className="surface-input theme-focus-accent mt-1.5 w-full rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              备注
              <textarea
                rows={3}
                value={draft.content}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                placeholder="这一集给你留下了什么印象？"
                className="surface-input theme-focus-accent mt-1.5 w-full rounded-xl px-3 py-2 text-sm leading-6 text-[var(--text-primary)]"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={resetComposer}
              className="rounded-xl px-3 py-2 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
            >
              取消
            </button>
            <AsyncButton
              onClick={submitNote}
              busy={saving}
              busyLabel="保存中…"
              className="theme-accent-button rounded-xl px-4 py-2 text-xs font-medium disabled:opacity-50"
            >
              {editingId ? '保存备注' : '添加备注'}
            </AsyncButton>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--text-muted)]">分集随记</p>
          <span className="text-xs text-[var(--text-muted)]">{episodeNotes.length} 条</span>
        </div>
        {episodeNotes.length > 0 ? (
          <div className="space-y-3">
            {episodeNotes.map((note) => (
              <article key={note.id} className="surface-card-muted rounded-2xl px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="theme-accent-soft rounded-full px-2.5 py-1 font-medium">第 {note.episode} 集</span>
                    <time className="text-[var(--text-muted)]">{note.notedAt}</time>
                  </div>
                  {canManageEpisodeNotes && editingId !== note.id && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        title="编辑备注"
                        onClick={() => {
                          setAdding(false);
                          setEditingId(note.id);
                          setDraft(noteDraft(note));
                        }}
                        className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      {deletingId === note.id ? (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void deleteNote(note.id)}
                            className="danger-soft rounded-lg px-2 py-1 text-xs disabled:opacity-50"
                          >
                            确认
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setDeletingId(null)}
                            className="rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] disabled:opacity-50"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          title="删除备注"
                          onClick={() => setDeletingId(note.id)}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-danger"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">{note.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">还没有分集随记。</p>
        )}
      </div>
    </div>
  );
}
