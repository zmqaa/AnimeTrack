import PageContainer from './PageContainer';
import Panel from './Panel';
import {
  AnimeGridSkeleton,
  CompactListSkeleton,
  ContentSkeleton,
  PanelSkeleton,
  Skeleton,
} from './Skeleton';

function LoadingStatus({ label }: { label: string }) {
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {label}
    </div>
  );
}

function PageHeadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-8 w-36 md:h-10 md:w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

export function DashboardRouteSkeleton() {
  return (
    <div className="relative space-y-4 p-4 pb-20 lg:space-y-6 lg:p-8" aria-busy="true">
      <LoadingStatus label="正在加载总览…" />
      <PanelSkeleton surface="strong" size="large" height="hero" className="rounded-[36px]" />
      <div className="relative z-10 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="flex flex-col gap-4 lg:col-span-8 lg:gap-5">
          <PanelSkeleton size="large" height="xlarge" />
          <PanelSkeleton size="large" height="large" />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-4 lg:gap-5">
          <PanelSkeleton size="large" height="medium" />
          <PanelSkeleton size="large" height="large" />
        </div>
      </div>
    </div>
  );
}

export function AnimeListRouteSkeleton() {
  return (
    <PageContainer as="main" width="wide" spacing="roomy" animation="none">
      <LoadingStatus label="正在加载番剧列表…" />
      <PanelSkeleton surface="strong" size="large" height="medium" className="rounded-[36px]" />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="space-y-4" aria-hidden="true">
            <Skeleton className="h-12 w-full" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <AnimeGridSkeleton count={8} />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <Panel size="large">
            <CompactListSkeleton count={5} />
          </Panel>
          <Panel size="large">
            <ContentSkeleton lines={5} />
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}

export function AnimeDetailRouteSkeleton() {
  return (
    <PageContainer width="wide" spacing="detail" animation="none">
      <LoadingStatus label="正在加载作品详情…" />
      <div
        className="relative overflow-hidden rounded-[32px] border border-[var(--border)] p-5 md:p-8 xl:p-10 2xl:p-12"
        style={{ backgroundColor: 'var(--bg-card)' }}
        aria-busy="true"
      >
        <Skeleton className="mb-6 h-5 w-24" />
        <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[390px_minmax(0,1fr)] 2xl:gap-10">
          <div className="space-y-5" aria-hidden="true">
            <Skeleton className="aspect-[3/4] w-full rounded-[28px]" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="space-y-7" aria-hidden="true">
            <div className="space-y-3">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-20 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
            <PanelSkeleton height="small" />
            <ContentSkeleton lines={5} />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export function AnalyticsRouteSkeleton({ label = '正在加载分析页面…' }: { label?: string }) {
  return (
    <PageContainer as="main" width="wide" spacing="roomy" animation="none">
      <LoadingStatus label={label} />
      <PanelSkeleton surface="strong" size="large" height="medium" className="rounded-[36px]" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2" aria-busy="true">
        <PanelSkeleton size="large" height="large" />
        <PanelSkeleton size="large" height="large" />
      </div>
      <PanelSkeleton size="large" height="large" />
    </PageContainer>
  );
}

export function ManagementRouteSkeleton({ label = '正在加载管理页面…' }: { label?: string }) {
  return (
    <main className="space-y-8 p-4 md:p-8" aria-busy="true">
      <LoadingStatus label={label} />
      <PageHeadingSkeleton />
      <div className="flex gap-3" aria-hidden="true">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-28" />
      </div>
      <PanelSkeleton size="large" height="large" />
      <PanelSkeleton size="large" height="medium" />
    </main>
  );
}

export function SettingsRouteSkeleton() {
  return (
    <main className="p-4 md:p-8" aria-busy="true">
      <LoadingStatus label="正在加载 AI 设置…" />
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeadingSkeleton />
        <Panel size="large" className="space-y-5">
          <Skeleton className="h-12 w-full" />
          <ContentSkeleton lines={2} />
          <ContentSkeleton lines={2} />
          <ContentSkeleton lines={2} />
          <Skeleton className="h-12 w-32" />
        </Panel>
      </div>
    </main>
  );
}
