
"use client";

import { memo } from 'react';
import { WatchHistoryRecord } from '@/lib/dashboard-types';
import EmptyState from '@/components/shared/EmptyState';

export default memo(function ActivityFeed({ history }: { history: WatchHistoryRecord[] }) {
    if (history.length === 0) {
        return (
            <EmptyState
                title="暂无活动记录"
                description="更新一次观看进度后，最近记录会显示在这里。"
                size="compact"
            />
        );
    }

    const grouped: Record<string, WatchHistoryRecord[]> = {};
    history.slice(0, 15).forEach(item => {
        const dateStr = new Date(item.watchedAt).toLocaleDateString('zh-CN');
        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(item);
    });

    return (
        <div className="space-y-8 relative border-l border-[var(--border)] ml-3 pl-7 py-3">
            {Object.entries(grouped).map(([date, items]) => (
                <div key={date} className="relative">
                    <span className="absolute -left-[34px] top-1.5 w-4 h-4 bg-[var(--bg-card)] border border-[var(--color-completed)]/30 rounded-full z-10 shadow-[0_0_12px_var(--color-completed-glow)]">
                        <span className="absolute inset-1 rounded-full bg-[var(--color-completed)]/70" />
                    </span>
                    <h4 className="text-[10px] font-mono text-[var(--text-muted)] mb-4 tracking-[0.28em] uppercase">{date}</h4>
                    <div className="space-y-3">
                        {items.map(item => (
                            <div key={item.id} className="group surface-card-muted rounded-[22px] px-4 py-3 hover:border-[var(--color-completed)]/20 hover:bg-[var(--color-surface-hover)] transition-all duration-300">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                    <div className="text-[11px] tracking-[0.24em] text-[var(--text-muted)]">观看记录</div>
                                        <span className="mt-1 block text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                                            观看 <span className="font-semibold text-[var(--accent)]">{item.animeTitle}</span>
                                        </span>
                                    </div>
                                    <span className="surface-pill shrink-0 text-[10px] font-mono text-[var(--text-muted)] px-2 py-1 rounded-full">
                                        第 {item.episode} 集
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
});
