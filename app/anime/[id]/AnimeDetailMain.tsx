import Link from 'next/link';
import {
  PencilSquareIcon, TrashIcon, CalendarIcon, CheckCircleIcon,
  ClockIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import type { AnimeDetailItem, AnimeStatus } from '@/lib/anime-shared';
import { statusMap, toTagInputValue, formatDateLabel, formatTimestampLabel } from './anime-detail-helpers';

type Props = {
  item: AnimeDetailItem;
  isAdmin: boolean;
  canEdit: boolean;
  saving: boolean;
  isAiEnriching: boolean;
  formData: Partial<AnimeDetailItem>;
  displayStatus: AnimeStatus;
  displayProgress: number;
  displayTotalEpisodes: number | undefined;
  displayDuration: number | undefined;
  displayTags: string[];
  progressPercent: number;
  onChange: (key: keyof AnimeDetailItem, value: unknown) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onEnrich: () => void;
  onDelete: () => void;
};

export default function AnimeDetailMain({
  item, isAdmin, canEdit, saving, isAiEnriching,
  formData, displayStatus, displayProgress, displayTotalEpisodes,
  displayDuration, displayTags, progressPercent,
  onChange, onEdit, onCancel, onSave, onEnrich, onDelete,
}: Props) {
  return (
    <section className="space-y-6">
      {/* Header: title + tags + actions */}
      <div className="surface-card rounded-[28px] p-6 md:p-8 xl:p-9 2xl:p-10 backdrop-blur-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            {canEdit ? (
              <>
                <input
                  value={formData.title || ''}
                  onChange={(event) => onChange('title', event.target.value)}
                  className="theme-focus-accent w-full border-b border-[var(--border)] bg-transparent pb-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)] transition"
                />
                <input
                  value={formData.originalTitle || ''}
                  placeholder="原名 / 日文名"
                  onChange={(event) => onChange('originalTitle', event.target.value)}
                  className="theme-focus-accent w-full border-b border-[var(--border)] bg-transparent pb-2 text-lg text-[var(--text-secondary)] transition"
                />
                <input
                  value={toTagInputValue(formData.tags)}
                  onChange={(event) => onChange('tags', event.target.value)}
                  placeholder="标签 (逗号分隔)"
                  className="surface-input theme-focus-accent w-full rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] transition"
                />
              </>
            ) : (
              <>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-[2.5rem]">{item.title}</h1>
                {item.originalTitle && <p className="text-lg text-[var(--text-secondary)]">{item.originalTitle}</p>}
                <div className="flex flex-wrap gap-2">
                  {displayTags.map((tag) => (
                    <span key={tag} className="surface-pill rounded-full px-3 py-1 text-xs text-[var(--text-primary)]">#{tag}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
              {canEdit ? (
                <>
                  <button onClick={onEnrich} disabled={isAiEnriching}
                    className="surface-pill rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] transition hover:bg-[var(--color-surface-hover)] disabled:opacity-50">
                    {isAiEnriching ? 'AI补充中...' : 'AI补充'}
                  </button>
                  <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]">
                    取消
                  </button>
                  <button onClick={onSave} disabled={saving}
                    className="theme-accent-button rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50">
                    {saving ? '保存中...' : '保存更改'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={onEnrich} disabled={isAiEnriching}
                    className="surface-pill rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] transition hover:bg-[var(--color-surface-hover)] disabled:opacity-50">
                    {isAiEnriching ? 'AI补充中...' : 'AI补充'}
                  </button>
                  <button onClick={onEdit}
                    className="surface-pill rounded-xl p-2.5 text-[var(--text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]">
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="surface-card-muted rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">观看状态</div>
            <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{statusMap[displayStatus]}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{item.isFinished ? '片源已完结' : '仍可能继续更新'}</div>
          </div>
          <div className="surface-card-muted rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">当前进度</div>
            <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{displayProgress} / {displayTotalEpisodes || '?'} EP</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">完成度 {Math.round(progressPercent)}%</div>
          </div>
          <div className="surface-card-muted rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">最近编辑</div>
            <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{formatTimestampLabel(item.updatedAt)}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">创建于 {formatDateLabel(item.createdAt?.slice(0, 10))}</div>
          </div>
        </div>
      </div>

      {/* Two-column content */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.92fr)] 2xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.95fr)] 2xl:gap-8">
        {/* Left column: progress, summary, notes */}
        <div className="space-y-6">
          {/* Progress */}
          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                <CheckCircleIcon className="h-4 w-4" />观看进度
              </h3>
              <span className="font-mono text-sm text-[var(--text-secondary)]">
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={formData.progress ?? item.progress}
                      onChange={(event) => onChange('progress', event.target.value)}
                      className="surface-input theme-focus-accent w-20 rounded-xl px-2 py-1.5 text-center text-sm text-[var(--text-primary)] transition" />
                    <span>/</span>
                    <input type="number" value={formData.totalEpisodes ?? item.totalEpisodes ?? ''}
                      onChange={(event) => onChange('totalEpisodes', event.target.value)} placeholder="?"
                      className="surface-input theme-focus-accent w-20 rounded-xl px-2 py-1.5 text-center text-sm text-[var(--text-primary)] transition" />
                  </div>
                ) : (
                  <><span className="text-2xl text-[var(--text-primary)]">{displayProgress}</span><span className="mx-1 text-[var(--text-muted)]">/</span><span>{displayTotalEpisodes || '?'}</span><span className="ml-1 text-xs text-[var(--text-muted)]">EP</span></>
                )}
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--bg-card)]">
              <div className="theme-spectrum-gradient h-full rounded-full transition-all duration-700" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="surface-card-muted rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">首播</div>
                <div className="mt-2 text-sm text-[var(--text-primary)]">{formatDateLabel(item.premiereDate)}</div>
              </div>
              <div className="surface-card-muted rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">单集时长</div>
                <div className="mt-2 text-sm text-[var(--text-primary)]">{displayDuration ? `${displayDuration} min` : '未知'}</div>
              </div>
              <div className="surface-card-muted rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">片源状态</div>
                <div className={`mt-2 text-sm font-medium ${item.isFinished ? 'theme-accent-text' : 'theme-secondary-text'}`}>
                  {item.isFinished ? '已完结' : '连载中'}
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              <SparklesIcon className="h-4 w-4" />简介 / 剧情
            </div>
            {canEdit ? (
              <textarea rows={8} value={formData.summary || ''}
                onChange={(event) => onChange('summary', event.target.value)}
                className="surface-input theme-focus-accent mt-4 min-h-[220px] w-full rounded-2xl p-4 text-sm leading-7 text-[var(--text-primary)] transition" />
            ) : (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-[var(--text-secondary)]">{item.summary || '暂无简介'}</p>
            )}
          </div>

          {/* Notes */}
          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              <ClockIcon className="h-4 w-4" />个人备注
            </div>
            {canEdit ? (
              <textarea rows={4} value={formData.notes || ''}
                onChange={(event) => onChange('notes', event.target.value)}
                className="surface-input theme-focus-accent mt-4 w-full rounded-2xl p-4 text-sm leading-7 text-[var(--text-primary)] transition" />
            ) : (
              <p className="mt-4 text-sm italic leading-7 text-[var(--text-secondary)]">{item.notes || '还没有留下观后感。'}</p>
            )}
          </div>
        </div>

        {/* Right column: timeline + cast */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              <CalendarIcon className="h-4 w-4" />时间轴
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {([
                ['开始观看', 'startDate'],
                ['看完日期', 'endDate'],
                ['首播日期', 'premiereDate'],
              ] as const).map(([label, key]) => (
                <div key={key} className="surface-card-muted flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  {canEdit ? (
                    <input type="date" value={(formData[key] as string) || ''}
                      onChange={(event) => onChange(key, event.target.value)}
                      className="surface-input theme-focus-accent rounded-xl px-2 py-1.5 text-sm text-[var(--text-primary)] transition" />
                  ) : (
                    <span className="text-[var(--text-primary)]">{formatDateLabel(item[key] as string | undefined)}</span>
                  )}
                </div>
              ))}
              <div className="surface-card-muted flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
                <span className="text-[var(--text-muted)]">放送状态</span>
                {canEdit ? (
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <input type="checkbox" checked={Boolean(formData.isFinished ?? item.isFinished)}
                      onChange={(event) => onChange('isFinished', event.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-card)] text-primary focus:ring-primary" />
                    已完结
                  </label>
                ) : (
                  <span className={item.isFinished ? 'theme-accent-text' : 'theme-secondary-text'}>
                    {item.isFinished ? '已完结' : '连载中'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cast */}
          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                <SparklesIcon className="h-4 w-4" />声优阵容
              </div>
              {!canEdit && item.cast && item.cast.length > 0 && (
                <span className="text-xs text-[var(--text-muted)]">{item.cast.length} 名</span>
              )}
            </div>
            {canEdit ? (
              <textarea rows={5}
                value={Array.isArray(formData.cast) ? formData.cast.join(', ') : (formData.cast || '')}
                placeholder="花泽香菜, 宫野真守 (逗号分隔)"
                onChange={(event) => onChange('cast', event.target.value.split(/[,，]/).map((name) => name.trim()).filter(Boolean))}
                className="surface-input theme-focus-accent mt-4 w-full rounded-2xl p-4 text-sm leading-7 text-[var(--text-primary)] transition" />
            ) : item.cast && item.cast.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.cast.map((cv, index) => (
                  <Link key={`${cv}-${index}`} href={`/anime?cast=${encodeURIComponent(cv)}`}
                    className="theme-secondary-soft rounded-full px-3 py-1.5 text-xs transition">
                    {cv}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">还没有补到声优信息。</p>
            )}
          </div>
        </div>
      </div>

      {/* Delete section */}
      {canEdit && (
        <div className="rounded-[24px] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-5 backdrop-blur-xl">
          <button onClick={onDelete} className="flex items-center gap-2 text-sm text-danger transition hover:text-danger">
            <TrashIcon className="h-4 w-4" />删除此番剧
          </button>
        </div>
      )}
    </section>
  );
}
