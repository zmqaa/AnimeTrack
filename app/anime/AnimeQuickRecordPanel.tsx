"use client";

import { SparklesIcon } from '@heroicons/react/24/outline';

type AnimeQuickRecordPanelProps = {
  quickInput: string;
  quickLoading: boolean;
  quickMessage: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
};

export default function AnimeQuickRecordPanel({
  quickInput,
  quickLoading,
  quickMessage,
  onInputChange,
  onSubmit,
}: AnimeQuickRecordPanelProps) {
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
      {quickMessage && (
        <p className={`text-xs mt-2 ${quickMessage.includes('失败') || quickMessage.includes('请输入') ? 'text-danger' : 'theme-accent-text'}`}>
          {quickMessage}
        </p>
      )}
    </section>
  );
}
