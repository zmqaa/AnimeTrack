"use client";

import Panel from './Panel';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton-shimmer rounded-2xl ${className}`} />
  );
}

type PanelSkeletonProps = {
  className?: string;
  height?: 'small' | 'medium' | 'large' | 'xlarge' | 'hero';
  size?: 'compact' | 'default' | 'large';
  surface?: 'glass' | 'strong' | 'card';
};

const panelSkeletonHeights: Record<NonNullable<PanelSkeletonProps['height']>, string> = {
  small: 'h-52',
  medium: 'h-64',
  large: 'h-80',
  xlarge: 'h-96',
  hero: 'h-[280px]',
};

export function PanelSkeleton({
  className = '',
  height = 'medium',
  size = 'default',
  surface = 'glass',
}: PanelSkeletonProps) {
  return (
    <Panel
      surface={surface}
      size={size}
      overflow="hidden"
      className={`${panelSkeletonHeights[height]} ${className}`}
      contentClassName="h-full"
    >
      <div className="skeleton-shimmer h-full w-full rounded-2xl opacity-60" />
    </Panel>
  );
}

export function ContentSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      <Skeleton className="h-5 w-2/5" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={`h-3 ${index === lines - 1 ? 'w-3/5' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function CompactListSkeleton({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface-card-muted flex items-center justify-between gap-4 rounded-[20px] px-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function AnimeCardSkeleton() {
  return (
    <div className="surface-card-muted rounded-2xl overflow-hidden">
      <div className="aspect-[3/4] skeleton-shimmer" />
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <Skeleton className="h-8 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-[2]" />
        </div>
      </div>
    </div>
  );
}

export function AnimeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AnimeListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card-muted flex gap-4 p-3 rounded-2xl">
          <Skeleton className="w-16 h-20 flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 py-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-1.5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass-panel rounded-[28px] p-5 space-y-4">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
