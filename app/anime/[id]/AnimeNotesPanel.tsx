"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDaysIcon,
  ChatBubbleBottomCenterTextIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import SectionTitle from '@/components/shared/SectionTitle';
import type { AnimeNoteEntry } from '@/lib/anime-shared';

type NoteDraft = {
  episode: string;
  notedAt: string;
  content: string;
};

type Props = {
  animeId: number;
  overallNote?: string;
  noteEntries: AnimeNoteEntry[];
  currentEpisode: number;
  canEdit: boolean;
  overallDraft?: string;
  onOverallChange: (value: string) => void;
  onNoteEntriesChange: (notes: AnimeNoteEntry[]) => void;
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

function draftFromNote(note: AnimeNoteEntry): NoteDraft {
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
  canEdit,
  overallDraft,
  onOverallChange,
  onNoteEntriesChange,
}: Props) {
  const episodeNotes = useMemo(
    () => noteEntries
      .filter((note) => note.episode !== undefined)
      .sort((left, right) => (
        right.notedAt.localeCompare(left.notedAt) || right.id - left.id
      )),
    [noteEntries],
  );
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(() => emptyDraft(currentEpisode));
  const [draftError, setDraftError] = useState('');

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingId(null);
    setDraftError('');
    setDraft(emptyDraft(currentEpisode));
  };

  useEffect(() => {
    if (!canEdit) closeComposer();
    // Only react to the page entering or leaving edit mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const saveDraft = () => {
    const episode = Number(draft.episode);
    const content = draft.content.trim();
    if (!Number.isInteger(episode) || episode < 1) {
      setDraftError('请输入有效集数');
      return;
    }
    if (!draft.notedAt) {
      setDraftError('请选择备注日期');
      return;
    }
    if (!content) {
      setDraftError('写一点这一集留下的印象吧');
      return;
    }

    const now = new Date().toISOString();
    if (editingId !== null) {
      onNoteEntriesChange(noteEntries.map((note) => (
        note.id === editingId
          ? { ...note, episode, content, notedAt: draft.notedAt, updatedAt: now }
          : note
      )));
    } else {
      const temporaryId = -Date.now();
      onNoteEntriesChange([
        ...noteEntries,
        {
          id: temporaryId,
          animeId,
          episode,
          content,
          notedAt: draft.notedAt,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
    closeComposer();
  };

  const deleteDraft = (noteId: number) => {
    onNoteEntriesChange(noteEntries.filter((note) => note.id !== noteId));
    if (editingId === noteId) closeComposer();
  };

  return (
    <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
      <SectionTitle
        size="small"
        icon={<ChatBubbleBottomCenterTextIcon className="h-4 w-4" />}
        action={canEdit && !composerOpen ? (
          <button
            type="button"
            onClick={() => {
              setDraft(emptyDraft(currentEpisode));
              setEditingId(null);
              setComposerOpen(true);
            }}
            className="theme-accent-soft flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            分集随记
          </button>
        ) : undefined}
      >
        个人备注
      </SectionTitle>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-medium tracking-wide text-[var(--text-muted)]">总体感受</p>
        {canEdit ? (
          <textarea
            rows={4}
            value={overallDraft || ''}
            onChange={(event) => onOverallChange(event.target.value)}
            placeholder="对整部作品的印象、期待或总结…"
            className="theme-focus-accent w-full resize-y rounded-2xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm leading-7 text-[var(--text-primary)] transition placeholder:text-[var(--text-muted)]"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
            {overallNote || '还没有留下总体备注。'}
          </p>
        )}
      </div>

      {canEdit && composerOpen && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3">
            <label className="theme-accent-soft flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
              <span>第</span>
              <input
                type="number"
                min={1}
                value={draft.episode}
                onChange={(event) => setDraft((current) => ({ ...current, episode: event.target.value }))}
                className="w-10 bg-transparent text-center font-mono text-[var(--text-primary)] outline-none"
              />
              <span>集</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <CalendarDaysIcon className="h-4 w-4" />
              <input
                type="date"
                value={draft.notedAt}
                onChange={(event) => setDraft((current) => ({ ...current, notedAt: event.target.value }))}
                className="bg-transparent text-[var(--text-secondary)] outline-none"
              />
            </label>
          </div>
          <textarea
            rows={4}
            autoFocus
            value={draft.content}
            onChange={(event) => {
              setDraft((current) => ({ ...current, content: event.target.value }));
              if (draftError) setDraftError('');
            }}
            placeholder="这一集给你留下了什么印象？"
            className="w-full resize-y bg-transparent px-4 py-4 text-sm leading-7 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
            <p className="text-xs text-danger">{draftError}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-full px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="theme-accent-button rounded-full px-4 py-1.5 text-xs font-medium"
              >
                {editingId !== null ? '完成修改' : '加入随记'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-medium tracking-wide text-[var(--text-muted)]">分集随记</p>
          {episodeNotes.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)]">{episodeNotes.length} 条</span>
          )}
        </div>
        {episodeNotes.length > 0 ? (
          <div className="space-y-3">
            {episodeNotes.map((note) => (
              <article
                key={note.id}
                className="group rounded-2xl border border-transparent bg-[var(--color-surface-subtle)] px-4 py-3.5 transition hover:border-[var(--border)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="theme-accent-text font-medium">EP {note.episode}</span>
                    <span className="h-1 w-1 rounded-full bg-[var(--text-muted)]" />
                    <time className="text-[var(--text-muted)]">{note.notedAt}</time>
                  </div>
                  {canEdit && !composerOpen && (
                    <div className="flex gap-1 opacity-70 transition group-hover:opacity-100">
                      <button
                        type="button"
                        title="编辑备注"
                        onClick={() => {
                          setEditingId(note.id);
                          setDraft(draftFromNote(note));
                          setComposerOpen(true);
                        }}
                        className="rounded-full p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="移除备注"
                        onClick={() => deleteDraft(note.id)}
                        className="rounded-full p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--color-surface-hover)] hover:text-danger"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">{note.content}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {canEdit ? '可以添加一条与集数关联的观看感受。' : '还没有分集随记。'}
          </p>
        )}
      </div>
    </div>
  );
}
