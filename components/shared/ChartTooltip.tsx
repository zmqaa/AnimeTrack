"use client";

import { CSSProperties } from 'react';

interface ChartTooltipProps {
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
  emphasis?: boolean;
  align?: 'left' | 'right';
  className?: string;
  style?: CSSProperties;
}

export default function ChartTooltip({
  label,
  value,
  unit,
  detail,
  emphasis = false,
  align = 'right',
  className = '',
  style,
}: ChartTooltipProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute top-2 z-20 min-w-[128px] rounded-xl px-3.5 py-3 shadow-theme-lg backdrop-blur-md ${align === 'right' ? 'right-2' : 'left-2'} ${className}`}
      style={{
        color: 'var(--chart-tooltip-text)',
        backgroundColor: 'var(--chart-tooltip-bg)',
        border: emphasis ? '1px solid var(--chart-line-start)' : '1px solid var(--chart-tooltip-border)',
        boxShadow: emphasis
          ? 'var(--shadow-lg), 0 0 0 1px var(--chart-tooltip-border)'
          : undefined,
        ...style,
      }}
    >
      <div className={`${emphasis ? 'text-xs font-bold' : 'text-[11px] font-semibold'} leading-4`} style={{ color: emphasis ? 'var(--chart-tooltip-text)' : 'var(--chart-tooltip-sub)' }}>
        {label}
      </div>
      <div className={`mt-1 whitespace-nowrap font-bold leading-6 ${emphasis ? 'text-xl' : 'text-lg'}`}>
        {value}{unit ? <span className="ml-1 text-sm font-semibold">{unit}</span> : null}
      </div>
      {detail ? (
        <div className="mt-0.5 whitespace-nowrap text-[10px] leading-4" style={{ color: 'var(--chart-tooltip-sub)' }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}
