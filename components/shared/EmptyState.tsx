"use client";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon = '📺', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8">
      <div className="surface-card-muted w-20 h-20 rounded-[24px] flex items-center justify-center mb-5">
        <span className="text-3xl">{icon}</span>
      </div>
      <h3 className="text-base font-display font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] text-center max-w-xs leading-relaxed">{description}</p>
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
