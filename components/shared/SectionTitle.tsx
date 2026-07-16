import type { ReactNode } from 'react';

interface SectionTitleProps {
  children: ReactNode;
  size?: 'small' | 'default';
  icon?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const titleSizeClasses = {
  small: 'text-sm uppercase tracking-[0.22em] text-[var(--text-secondary)]',
  default: 'font-display text-lg text-[var(--text-primary)]',
};

export default function SectionTitle({
  children,
  size = 'default',
  icon,
  description,
  action,
  className = '',
}: SectionTitleProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className={`flex items-center font-semibold ${icon ? 'gap-2' : 'gap-3'} ${titleSizeClasses[size]}`}>
          {icon ? (
            <span aria-hidden="true" className="shrink-0 text-[var(--text-secondary)]">{icon}</span>
          ) : (
            <span aria-hidden="true" className="theme-accent-fill h-5 w-1 shrink-0 rounded-full" />
          )}
          {children}
        </h2>
        {description ? (
          <div className="mt-1 text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--text-muted)]">
            {description}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
