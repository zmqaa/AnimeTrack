"use client";

import { SparklesIcon } from '@heroicons/react/24/outline';
import type { QuickRecordProgressEvent } from '@/lib/quick-record-progress';

type AnimeQuickRecordPanelProps = {
  quickInput: string;
  quickLoading: boolean;
  quickMessage: string;
  quickProgress: QuickRecordProgressEvent[];
  onInputChange: (value: string) => void;
  onSubmit: () => void;
};

export default function AnimeQuickRecordPanel({
  quickInput,
  quickLoading,
  quickMessage,
  quickProgress,
  onInputChange,
  onSubmit,
}: AnimeQuickRecordPanelProps) {
  const statusColor: Record<QuickRecordProgressEvent['status'], string> = {
    running: 'bg-[var(--color-plan)]',
    success: 'bg-[var(--color-completed)]',
    warning: 'bg-amber-500',
    error: 'bg-[var(--color-danger)]',
    info: 'bg-[var(--text-muted)]',
  };

  return (
    <section className="surface-card rounded-2xl p-5 shadow-xl">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider">
        <SparklesIcon className="theme-accent-text w-4 h-4" />
        AI录入
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="mt-3 flex flex-col md:flex-row gap-2"
      >
        <input
          type="text"
          value={quickInput}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="例如：摇曳露营第三季"
          className="surface-input theme-focus-accent flex-1 rounded-xl px-4 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={quickLoading}
          className="theme-accent-button rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {quickLoading ? '录入中...' : 'AI录入'}
        </button>
      </form>

      <p className="text-xs text-[var(--text-muted)] mt-2">输入动漫名称，AI 会搜索并补全作品资料。默认状态为追番中，进度为 0。</p>
      {quickProgress.length > 0 && (
        <div
          className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--color-surface)] px-4 py-3"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[var(--text-secondary)]">录入过程</p>
            <span className="text-[11px] text-[var(--text-muted)]">
              {quickLoading ? '实时更新中' : '本次运行记录'}
            </span>
          </div>

          <ol className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
            {quickProgress.map((event, index) => {
              const isLatestRunning = quickLoading
                && index === quickProgress.length - 1
                && event.status === 'running';

              return (
                <li key={`${event.stage}-${index}`} className="relative pl-5 text-xs">
                  <span
                    className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${statusColor[event.status]} ${isLatestRunning ? 'animate-pulse' : ''}`}
                  />
                  <p className="font-medium text-[var(--text-secondary)]">{event.message}</p>
                  {event.detail && (
                    <p className="mt-1 break-words text-[11px] text-[var(--text-muted)]">{event.detail}</p>
                  )}
                  {event.items && event.items.length > 0 && (
                    <ul className="mt-1.5 space-y-1 rounded-lg bg-[var(--color-surface-raised)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
                      {event.items.map((item, itemIndex) => (
                        <li key={`${item}-${itemIndex}`} className="break-words">{item}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {quickMessage && (
        <p className={`text-xs mt-2 ${quickMessage.includes('失败') || quickMessage.includes('请输入') ? 'text-danger' : 'theme-accent-text'}`}>
          {quickMessage}
        </p>
      )}
    </section>
  );
}
