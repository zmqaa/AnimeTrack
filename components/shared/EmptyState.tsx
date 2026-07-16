"use client";

interface EmptyStateProps {
  title: string;
  description?: string;
  size?: 'compact' | 'default';
  surface?: 'none' | 'panel' | 'card';
  className?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const surfaceClasses = {
  none: '',
  panel: 'glass-panel rounded-[28px]',
  card: 'surface-card rounded-3xl',
};

const sizeClasses = {
  compact: {
    root: 'px-5 py-10',
  },
  default: {
    root: 'px-8 py-20',
  },
};

export default function EmptyState({
  title,
  description,
  size = 'default',
  surface = 'none',
  className = '',
  action,
}: EmptyStateProps) {
  const sizing = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${surfaceClasses[surface]} ${sizing.root} ${className}`}>
      <h3 className="text-base font-display font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      {description && (
        <p className="max-w-md text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="success-soft mt-5 px-5 py-2.5 rounded-xl text-sm font-medium hover:brightness-110 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
