'use client';

import React from 'react';
import Link from 'next/link';
import type { ComponentType } from 'react';

interface StatItem {
  label: string;
  value: string;
  unit: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  href?: string;
  prefix?: string;
}

export default React.memo(function DashboardStatCards({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
      {stats.map((stat, i) => {
        const content = (
          <>
            <div className="absolute -bottom-3 -right-3 opacity-[0.06] group-hover:opacity-[0.14] transition-all duration-500 scale-150 group-hover:rotate-12 pointer-events-none">
              <stat.icon className={`w-20 h-20 ${stat.color}`} />
            </div>
            <div className="flex items-start relative z-10">
              <div className={`flex items-center justify-center w-8 h-8 rounded-xl ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="relative z-10">
              <div className="flex items-baseline gap-1.5">
                {stat.prefix ? (
                  <span className="text-sm font-semibold tracking-[0.18em] text-zinc-400">{stat.prefix}</span>
                ) : null}
                <span className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">{stat.value}</span>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-tighter">{stat.unit}</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.18em] mt-0.5 group-hover:text-zinc-400 transition-colors">
                {stat.label}
              </div>
            </div>
          </>
        );

        const className = "glass-panel surface-card-muted px-5 py-5 rounded-[28px] transition-all duration-500 hover:-translate-y-1 group relative overflow-hidden flex flex-col gap-4";

        return stat.href ? (
          <Link key={i} href={stat.href} className={className}>{content}</Link>
        ) : (
          <div key={i} className={className}>{content}</div>
        );
      })}
    </div>
  );
});
