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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
      {stats.map((stat, i) => {
        const content = (
          <div className="flex items-center justify-between w-full">
            <span className="text-base font-bold text-[var(--text-secondary)] tracking-wide">
              {stat.label}
            </span>
            <div className="flex items-baseline gap-1.5 shrink-0">
              {stat.prefix ? (
                <span className="text-sm font-semibold text-[var(--text-muted)]">{stat.prefix}</span>
              ) : null}
              <span className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{stat.value}</span>
              <span className="text-sm text-[var(--text-muted)] font-bold">{stat.unit}</span>
            </div>
          </div>
        );

        const className = "glass-panel surface-card-muted px-5 py-4 rounded-[24px] transition-all duration-300 hover:-translate-y-0.5 group relative overflow-hidden flex items-center";

        return stat.href ? (
          <Link key={i} href={stat.href} className={className}>{content}</Link>
        ) : (
          <div key={i} className={className}>{content}</div>
        );
      })}
    </div>
  );
});
