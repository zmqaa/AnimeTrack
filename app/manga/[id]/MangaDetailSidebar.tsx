import FormField from '@/components/shared/FormField';
import StatTile from '@/components/shared/StatTile';
import {
  MANGA_READING_STATUS_LABELS,
  type MangaReadingStatus,
  type MangaRecord,
} from '@/lib/manga-shared';
import type { MangaDetailDraft } from './manga-detail-helpers';

const statusBadgeStyles: Record<MangaReadingStatus, string> = {
  plan_to_read: 'status-plan-soft',
  reading: 'status-watching-soft',
  caught_up: 'badge-airing-soft',
  completed: 'status-completed-soft',
  paused: 'surface-pill',
  dropped: 'status-dropped-soft',
};

type Props = {
  record: MangaRecord;
  draft: MangaDetailDraft;
  canEdit: boolean;
  onChange: <K extends keyof MangaDetailDraft>(key: K, value: MangaDetailDraft[K]) => void;
};

export default function MangaDetailSidebar({ record, draft, canEdit, onChange }: Props) {
  return (
    <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
      <div className="glass-panel-strong shadow-theme-lg overflow-hidden rounded-[28px]">
        <div className="aspect-[2/3] w-full bg-[var(--bg-card)]">
          {draft.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.coverUrl} alt={draft.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">暂无封面</div>
          )}
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--color-surface-raised)] p-4">
          <div className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold tracking-[0.18em] ${statusBadgeStyles[draft.status]}`}>
            {MANGA_READING_STATUS_LABELS[draft.status]}
          </div>
        </div>
      </div>

      <div className="surface-card rounded-[24px] p-5 2xl:p-6 backdrop-blur-xl">
        {canEdit ? (
          <div className="space-y-4">
            <FormField label="阅读状态">
              <select
                value={draft.status}
                onChange={(event) => onChange('status', event.target.value as MangaReadingStatus)}
                className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)]"
              >
                {(Object.entries(MANGA_READING_STATUS_LABELS) as Array<[MangaReadingStatus, string]>).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="个人评分" hint="0～10 分，可留空">
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={draft.score}
                onChange={(event) => onChange('score', event.target.value)}
                className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)]"
                placeholder="未评分"
              />
            </FormField>
            <FormField label="封面链接">
              <input
                value={draft.coverUrl}
                onChange={(event) => onChange('coverUrl', event.target.value)}
                className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </FormField>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatTile size="compact" valueTone="score" label="评分" value={record.score != null ? `★ ${record.score}` : '-'} />
            <StatTile size="compact" valueTone="primary" label="当前卷" value={record.currentVolume || '-'} />
            <StatTile size="compact" valueTone="primary" label="当前话" value={record.currentChapter || '-'} />
          </div>
        )}
      </div>
    </aside>
  );
}
