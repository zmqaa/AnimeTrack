"use client";

import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import PageContainer from '@/components/shared/PageContainer';
import { classifyAnimeDetailLoadError } from './anime-detail-helpers';

type AnimeDetailLoadErrorProps = {
  error: unknown;
  isRetrying: boolean;
  onRetry: () => void;
  onBack: () => void;
  onLogin: () => void;
};

const icons = {
  'not-found': MagnifyingGlassIcon,
  forbidden: LockClosedIcon,
  unavailable: ExclamationTriangleIcon,
};

export default function AnimeDetailLoadError({
  error,
  isRetrying,
  onRetry,
  onBack,
  onLogin,
}: AnimeDetailLoadErrorProps) {
  const state = classifyAnimeDetailLoadError(error);
  const Icon = icons[state.kind];

  return (
    <PageContainer width="content" spacing="roomy" animation="fade">
      <section
        className="glass-panel-strong mx-auto flex min-h-[440px] max-w-3xl flex-col items-center justify-center rounded-[32px] border border-[var(--border)] px-6 py-12 text-center md:px-12"
        role="alert"
        aria-busy={isRetrying}
      >
        <div className="theme-accent-soft flex h-16 w-16 items-center justify-center rounded-2xl">
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>

        <h1 className="mt-6 font-display text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">
          {state.title}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--text-secondary)]">
          {state.description}
        </p>

        {state.detail && (
          <p className="mt-4 max-w-lg break-words rounded-xl bg-[var(--tag-bg)] px-4 py-2 font-mono text-xs text-[var(--text-muted)]">
            {state.detail}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            aria-busy={isRetrying}
            className="theme-accent-button inline-flex min-w-32 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-wait disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isRetrying ? '正在重试…' : state.kind === 'not-found' ? '重新检查' : '重试加载'}
          </button>

          {state.kind === 'forbidden' && (
            <button
              type="button"
              onClick={onLogin}
              className="surface-pill rounded-2xl px-5 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              重新登录
            </button>
          )}

          <button
            type="button"
            onClick={onBack}
            className="surface-pill inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            返回番剧列表
          </button>
        </div>
      </section>
    </PageContainer>
  );
}
