'use client';

import React from 'react';
import Link from 'next/link';

interface StatItem {
  label: string;
  value: string;
  unit: string;
  href?: string;
  prefix?: string;
}

export default React.memo(function DashboardStatCards({ stats }: { stats: StatItem[] }) {
  return (
    <div className="glass-panel relative z-10 grid grid-cols-2 overflow-hidden rounded-[24px] lg:grid-cols-4">
      {stats.map((stat, i) => {
        const content = (
          <div className="w-full">
            <div className="stat-tile-label">{stat.label}</div>
            <div className="stat-tile-value-row">
              {stat.prefix ? (
                <span className="stat-tile-unit">{stat.prefix}</span>
              ) : null}
              <span className="stat-tile-value">{stat.value}</span>
              <span className="stat-tile-unit">{stat.unit}</span>
            </div>
          </div>
        );

        const dividerClass = i === 0
          ? 'border-b border-r border-[var(--border)] lg:border-b-0'
          : i === 1
            ? 'border-b border-[var(--border)] lg:border-b-0 lg:border-r'
            : i === 2
              ? 'border-r border-[var(--border)]'
              : '';
        const className = `group relative flex min-w-0 items-center px-5 py-4 transition-colors hover:bg-[var(--color-surface-hover)] lg:px-6 ${dividerClass}`;

        return stat.href ? (
          <Link key={i} href={stat.href} className={className}>{content}</Link>
        ) : (
          <div key={i} className={className}>{content}</div>
        );
      })}
    </div>
  );
});
