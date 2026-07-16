'use client';

import type { ComponentType } from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  activeClassName?: string;
  iconClassName?: string;
  iconOnly?: boolean;
}

export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  buttonClassName = 'px-4 py-1.5 text-xs font-bold uppercase',
  activeClassName = 'text-primary',
  iconClassName = 'h-3.5 w-3.5',
  iconOnly = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`surface-card-muted flex items-stretch divide-x divide-[var(--border-light)] rounded-xl p-1 ${className}`}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? label : undefined}
            onClick={() => onChange(optionValue)}
            style={selected ? { backgroundColor: 'var(--bg-control, var(--color-surface-raised))' } : undefined}
            className={`flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors first:rounded-l-lg last:rounded-r-lg ${buttonClassName} ${
              selected
                ? activeClassName
                : 'text-[var(--text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {Icon && <Icon className={iconClassName} />}
            <span className={iconOnly ? 'sr-only' : undefined}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
