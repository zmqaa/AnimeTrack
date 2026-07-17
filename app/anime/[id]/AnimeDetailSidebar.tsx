import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import type { AnimeDetailItem, AnimeStatus } from '@/lib/anime-shared';
import { statusMap, statusBadgeStyles } from './anime-detail-helpers';
import FormField from '@/components/shared/FormField';
import StatTile from '@/components/shared/StatTile';

type Props = {
  item: AnimeDetailItem;
  canEdit: boolean;
  formData: Partial<AnimeDetailItem>;
  displayStatus: AnimeStatus;
  displayScore: number | undefined;
  displayTotalEpisodes: number | undefined;
  displayDuration: number | undefined;
  onChange: (key: keyof AnimeDetailItem, value: unknown) => void;
};

export default function AnimeDetailSidebar({
  item,
  canEdit,
  formData,
  displayStatus,
  displayScore,
  displayTotalEpisodes,
  displayDuration,
  onChange,
}: Props) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const coverUrl = (typeof formData.coverUrl === 'string' ? formData.coverUrl : undefined)
    || item.displayCoverUrl
    || '';

  useEffect(() => {
    if (!statusMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!statusMenuRef.current?.contains(event.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStatusMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [statusMenuOpen]);

  return (
    <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
      {/* Cover Image */}
      <div className="glass-panel-strong shadow-theme-lg overflow-hidden rounded-[28px]">
        <div className="aspect-[2/3] w-full bg-[var(--bg-card)]">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">无封面</div>
          )}
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--color-surface-raised)] p-4">
          <div className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold tracking-[0.2em] ${statusBadgeStyles[displayStatus]}`}>
            {statusMap[displayStatus]}
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="surface-card rounded-[24px] p-5 2xl:p-6 backdrop-blur-xl">
        {canEdit ? (
          <div className="space-y-4">
            <FormField label="状态">
              <div ref={statusMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={statusMenuOpen}
                  onClick={() => setStatusMenuOpen((open) => !open)}
                  className="surface-input theme-focus-accent flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-light)]"
                >
                  <span>{statusMap[displayStatus]}</span>
                  <ChevronUpDownIcon className="h-4 w-4 text-[var(--text-secondary)]" />
                </button>

                {statusMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="观看状态"
                    className="surface-card shadow-theme-lg absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 flex flex-col gap-1 rounded-2xl p-2 backdrop-blur-xl"
                  >
                    {(Object.keys(statusMap) as AnimeStatus[]).map((status) => {
                      const selected = status === displayStatus;
                      return (
                        <button
                          key={status}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            onChange('status', status);
                            setStatusMenuOpen(false);
                          }}
                          className={selected
                            ? 'surface-pill theme-selected-pill flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm'
                            : 'flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]'}
                        >
                          <span>{statusMap[status]}</span>
                          {selected && <CheckIcon className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="评分">
                <input
                  type="number"
                  value={formData.score ?? ''}
                  onChange={(event) => onChange('score', event.target.value)}
                  className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition"
                />
              </FormField>
              <FormField label="单集时长">
                <input
                  type="number"
                  value={formData.durationMinutes ?? ''}
                  onChange={(event) => onChange('durationMinutes', event.target.value)}
                  className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition"
                />
              </FormField>
            </div>
            <FormField label="封面链接">
              <input
                value={formData.coverUrl || ''}
                onChange={(event) => onChange('coverUrl', event.target.value)}
                className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition"
              />
            </FormField>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatTile size="compact" valueTone="score" label="评分" value={displayScore ? `★ ${displayScore}` : '-'} />
            <StatTile size="compact" valueTone="primary" label="集数" value={displayTotalEpisodes || '?'} />
            <StatTile size="compact" valueTone="primary" label="时长" value={displayDuration ? `${displayDuration}m` : '-'} />
          </div>
        )}
      </div>
    </aside>
  );
}
