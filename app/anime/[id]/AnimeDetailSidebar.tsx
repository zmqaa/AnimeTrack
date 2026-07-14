import type { AnimeDetailItem, AnimeStatus } from '@/lib/anime-shared';
import { statusMap, statusBadgeStyles } from './anime-detail-helpers';

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
  const coverUrl = (typeof formData.coverUrl === 'string' ? formData.coverUrl : undefined) || item.coverUrl || '';

  return (
    <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
      {/* Cover Image */}
      <div className="glass-panel-strong overflow-hidden rounded-[28px] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
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
            <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">No Image</div>
          )}
        </div>
        <div className="border-t border-[var(--border)] bg-black/20 p-4">
          <div className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold tracking-[0.2em] ${statusBadgeStyles[displayStatus]}`}>
            {statusMap[displayStatus]}
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="surface-card rounded-[24px] p-5 2xl:p-6 backdrop-blur-xl">
        {canEdit ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">状态</label>
              <select
                value={formData.status || item.status}
                onChange={(event) => onChange('status', event.target.value as AnimeStatus)}
                className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition"
              >
                {Object.keys(statusMap).map((status) => (
                  <option key={status} value={status}>{statusMap[status as AnimeStatus]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">评分</label>
                <input
                  type="number"
                  value={formData.score ?? ''}
                  onChange={(event) => onChange('score', event.target.value)}
                  className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">单集时长</label>
                <input
                  type="number"
                  value={formData.durationMinutes ?? ''}
                  onChange={(event) => onChange('durationMinutes', event.target.value)}
                  className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">封面链接</label>
              <input
                value={formData.coverUrl || ''}
                onChange={(event) => onChange('coverUrl', event.target.value)}
                className="surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="surface-card-muted rounded-2xl p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">评分</div>
              <div className="mt-2 text-lg font-semibold score-text">{displayScore ? `★ ${displayScore}` : '-'}</div>
            </div>
            <div className="surface-card-muted rounded-2xl p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">集数</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{displayTotalEpisodes || '?'}</div>
            </div>
            <div className="surface-card-muted rounded-2xl p-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">时长</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{displayDuration ? `${displayDuration}m` : '-'}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
