import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  CalendarIcon,
  PencilSquareIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

import AsyncButton from '@/components/shared/AsyncButton';
import FormField from '@/components/shared/FormField';
import SectionTitle from '@/components/shared/SectionTitle';
import SegmentedControl from '@/components/shared/SegmentedControl';
import StatTile from '@/components/shared/StatTile';
import {
  MANGA_PUBLICATION_STATUS_LABELS,
  MANGA_READING_STATUS_LABELS,
  type MangaPublicationStatus,
  type MangaRecord,
} from '@/lib/manga-shared';
import {
  formatMangaDate,
  formatMangaTimestamp,
  type MangaDetailDraft,
} from './manga-detail-helpers';

const inputClass = 'surface-input theme-focus-accent w-full rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition';

type Props = {
  record: MangaRecord;
  draft: MangaDetailDraft;
  isAdmin: boolean;
  canEdit: boolean;
  saving: boolean;
  isRefreshing: boolean;
  onChange: <K extends keyof MangaDetailDraft>(key: K, value: MangaDetailDraft[K]) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onRefresh: () => void;
  onDelete: () => void;
};

function metadataValue(values: string[]) {
  return values.length > 0 ? values.join('、') : '未记录';
}

export default function MangaDetailMain({
  record,
  draft,
  isAdmin,
  canEdit,
  saving,
  isRefreshing,
  onChange,
  onEdit,
  onCancel,
  onSave,
  onRefresh,
  onDelete,
}: Props) {
  const position = [
    record.currentVolume ? `第 ${record.currentVolume} 卷` : '',
    record.currentChapter ? `第 ${record.currentChapter} 话` : '',
  ].filter(Boolean).join(' · ') || '尚未记录';

  return (
    <section className="space-y-6">
      <div className="surface-card rounded-[28px] p-6 md:p-8 xl:p-9 2xl:p-10 backdrop-blur-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            {canEdit ? (
              <>
                <input
                  value={draft.title}
                  onChange={(event) => onChange('title', event.target.value)}
                  className="theme-focus-accent w-full border-b border-[var(--border)] bg-transparent pb-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)] transition"
                />
                <input
                  value={draft.originalTitle}
                  onChange={(event) => onChange('originalTitle', event.target.value)}
                  placeholder="原名 / 日文名"
                  className="theme-focus-accent w-full border-b border-[var(--border)] bg-transparent pb-2 text-lg text-[var(--text-secondary)] transition"
                />
                <input
                  value={draft.tags}
                  onChange={(event) => onChange('tags', event.target.value)}
                  placeholder="标签（顿号或逗号分隔）"
                  className="surface-input theme-focus-accent w-full rounded-2xl px-4 py-3 text-sm text-[var(--text-primary)] transition"
                />
              </>
            ) : (
              <>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-[2.5rem]">{record.title}</h1>
                {record.originalTitle ? <p className="text-lg text-[var(--text-secondary)]">{record.originalTitle}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {record.tags.map((tag) => <span key={tag} className="surface-pill rounded-full px-3 py-1 text-xs text-[var(--text-primary)]">#{tag}</span>)}
                </div>
              </>
            )}
          </div>

          {isAdmin ? (
            <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
              {record.bangumiId && !canEdit ? (
                <AsyncButton
                  onClick={onRefresh}
                  busy={isRefreshing}
                  busyLabel="更新中…"
                  disabled={saving}
                  className="surface-pill inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] transition hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
                >
                  <ArrowPathIcon className="h-4 w-4" />更新资料
                </AsyncButton>
              ) : null}
              {canEdit ? (
                <>
                  <button onClick={onDelete} disabled={saving || isRefreshing} className="danger-soft flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition hover:brightness-95 disabled:opacity-50">
                    <TrashIcon className="h-4 w-4" />删除此漫画
                  </button>
                  <button onClick={onCancel} disabled={saving || isRefreshing} className="rounded-xl px-4 py-2.5 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50">取消</button>
                  <AsyncButton onClick={onSave} busy={saving} busyLabel="正在保存…" disabled={isRefreshing} className="theme-accent-button rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50">保存更改</AsyncButton>
                </>
              ) : (
                <>
                  <button onClick={onDelete} className="danger-soft flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition hover:brightness-95">
                    <TrashIcon className="h-4 w-4" />删除此漫画
                  </button>
                  <button onClick={onEdit} aria-label="编辑漫画" title="编辑漫画" className="surface-pill rounded-xl p-2.5 text-[var(--text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)]">
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatTile size="small" valueTone="primary" label="阅读状态" value={MANGA_READING_STATUS_LABELS[record.status]} detail={MANGA_PUBLICATION_STATUS_LABELS[record.publicationStatus]} />
          <StatTile size="small" valueTone="primary" label="当前进度" value={position} detail={record.totalChapters ? `参考共 ${record.totalChapters} 话` : '不依赖固定总话数'} />
          <StatTile size="small" valueTone="primary" label="最近编辑" value={formatMangaTimestamp(record.updatedAt)} detail={`创建于 ${formatMangaDate(record.createdAt.slice(0, 10))}`} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.92fr)] 2xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.95fr)] 2xl:gap-8">
        <div className="space-y-6">
          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <SectionTitle size="small" icon={<BookOpenIcon className="h-4 w-4" />}>我的阅读</SectionTitle>
            {canEdit ? (
              <div className="mt-4 space-y-5">
                <FormField label="作品连载状态" hint="作品本身的出版状态，与个人阅读状态分开记录。">
                  <SegmentedControl
                    value={draft.publicationStatus}
                    options={(Object.entries(MANGA_PUBLICATION_STATUS_LABELS) as Array<[MangaPublicationStatus, string]>).map(([value, label]) => ({ value, label }))}
                    onChange={(value) => onChange('publicationStatus', value)}
                    ariaLabel="作品连载状态"
                    className="max-w-full overflow-x-auto no-scrollbar"
                    buttonClassName="px-4 py-2 text-sm font-medium"
                    activeClassName="theme-accent-text"
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="当前卷" hint="例如 5；没有分卷时留空"><input value={draft.currentVolume} onChange={(event) => onChange('currentVolume', event.target.value)} className={inputClass} placeholder="未记录" /></FormField>
                  <FormField label="当前话" hint="支持 42.5、番外 3 等写法"><input value={draft.currentChapter} onChange={(event) => onChange('currentChapter', event.target.value)} className={inputClass} placeholder="未记录" /></FormField>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatTile size="small" valueTone="primary" label="当前卷" value={record.currentVolume || '未记录'} />
                <StatTile size="small" valueTone="primary" label="当前话" value={record.currentChapter || '未记录'} />
                <StatTile size="small" valueTone="primary" label="作品状态" value={MANGA_PUBLICATION_STATUS_LABELS[record.publicationStatus]} />
              </div>
            )}
          </div>

          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <SectionTitle size="small" icon={<SparklesIcon className="h-4 w-4" />}>简介 / 内容</SectionTitle>
            {canEdit ? (
              <textarea value={draft.summary} onChange={(event) => onChange('summary', event.target.value)} className="surface-input theme-focus-accent mt-4 min-h-[220px] w-full resize-y rounded-2xl p-4 text-sm leading-7 text-[var(--text-primary)] transition" />
            ) : (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-[var(--text-secondary)]">{record.summary || '暂无简介'}</p>
            )}
          </div>

          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <SectionTitle size="small" icon={<BookOpenIcon className="h-4 w-4" />}>阅读笔记</SectionTitle>
            {canEdit ? (
              <textarea value={draft.notes} onChange={(event) => onChange('notes', event.target.value)} className="surface-input theme-focus-accent mt-4 min-h-40 w-full resize-y rounded-2xl p-4 text-sm leading-7 text-[var(--text-primary)] transition" placeholder="记录对这部漫画的整体感受…" />
            ) : (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-[var(--text-secondary)]">{record.notes || '还没有记录阅读笔记。'}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <SectionTitle size="small" icon={<CalendarIcon className="h-4 w-4" />}>时间轴</SectionTitle>
            <div className="mt-4 space-y-3 text-sm">
              {([
                ['开始阅读', 'startDate'],
                ['读完日期', 'endDate'],
                ['发行日期', 'releaseDate'],
              ] as const).map(([label, key]) => (
                <div key={key} className="surface-card-muted flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  {canEdit ? (
                    <input type="date" value={draft[key]} onChange={(event) => onChange(key, event.target.value)} className="surface-input theme-focus-accent rounded-xl px-2 py-1.5 text-sm text-[var(--text-primary)]" />
                  ) : (
                    <span className="text-[var(--text-primary)]">{formatMangaDate(record[key])}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card rounded-[24px] p-6 backdrop-blur-xl">
            <SectionTitle
              size="small"
              icon={<SparklesIcon className="h-4 w-4" />}
              action={record.bangumiId ? (
                <a href={`https://bgm.tv/subject/${record.bangumiId}`} target="_blank" rel="noreferrer" className="surface-pill inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
                  Bangumi #{record.bangumiId}<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </a>
              ) : undefined}
            >
              作品资料
            </SectionTitle>
            {canEdit ? (
              <div className="mt-4 grid gap-4">
                <FormField label="作者"><input value={draft.authors} onChange={(event) => onChange('authors', event.target.value)} className={inputClass} /></FormField>
                <FormField label="作画"><input value={draft.illustrators} onChange={(event) => onChange('illustrators', event.target.value)} className={inputClass} /></FormField>
                <FormField label="出版社"><input value={draft.publishers} onChange={(event) => onChange('publishers', event.target.value)} className={inputClass} /></FormField>
                <FormField label="连载杂志或平台"><input value={draft.serializations} onChange={(event) => onChange('serializations', event.target.value)} className={inputClass} /></FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="参考卷数"><input type="number" min="0" value={draft.totalVolumes} onChange={(event) => onChange('totalVolumes', event.target.value)} className={inputClass} /></FormField>
                  <FormField label="参考话数"><input type="number" min="0" value={draft.totalChapters} onChange={(event) => onChange('totalChapters', event.target.value)} className={inputClass} /></FormField>
                </div>
                <FormField label="别名"><textarea value={draft.aliases} onChange={(event) => onChange('aliases', event.target.value)} className={`${inputClass} min-h-20 resize-y`} /></FormField>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ['作者', metadataValue(record.authors)],
                  ['作画', metadataValue(record.illustrators)],
                  ['出版社', metadataValue(record.publishers)],
                  ['连载平台', metadataValue(record.serializations)],
                  ['参考卷数', record.totalVolumes ? `${record.totalVolumes} 卷` : '未记录'],
                  ['参考话数', record.totalChapters ? `${record.totalChapters} 话` : '未记录'],
                  ['别名', metadataValue(record.aliases)],
                ].map(([label, value]) => (
                  <div key={label} className="surface-card-muted flex items-start justify-between gap-4 rounded-2xl px-4 py-3">
                    <span className="shrink-0 text-[var(--text-muted)]">{label}</span><span className="text-right text-[var(--text-primary)]">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
