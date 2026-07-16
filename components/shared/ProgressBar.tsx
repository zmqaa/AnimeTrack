type ProgressBarProps = {
  value: number;
  variant?: 'accent' | 'progress' | 'completed';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  fillClassName?: string;
  label?: string;
};

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-3',
} as const;

const fillClasses = {
  accent: 'theme-accent-fill',
  progress: 'progress-gradient',
  completed: 'progress-completed',
} as const;

export default function ProgressBar({
  value,
  variant = 'progress',
  size = 'sm',
  className = '',
  fillClassName = '',
  label,
}: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div
      className={`progress-track ${sizeClasses[size]} ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
    >
      <div
        className={`progress-fill ${fillClasses[variant]} ${fillClassName}`}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
