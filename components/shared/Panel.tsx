import type { ElementType, ReactNode } from 'react';
import SectionTitle from './SectionTitle';

type PanelSurface = 'glass' | 'strong' | 'card';
type PanelSize = 'flush' | 'compact' | 'default' | 'large';
type PanelOverflow = 'visible' | 'hidden' | 'auto';

type PanelProps = {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  surface?: PanelSurface;
  size?: PanelSize;
  overflow?: PanelOverflow;
  as?: ElementType;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

const surfaceClasses: Record<PanelSurface, string> = {
  glass: 'glass-panel',
  strong: 'glass-panel-strong',
  card: 'surface-card',
};

const sizeClasses: Record<PanelSize, string> = {
  flush: 'rounded-[28px]',
  compact: 'rounded-[28px] p-4 md:p-5',
  default: 'rounded-[28px] p-5 md:p-6',
  large: 'rounded-[32px] p-6 lg:p-7',
};

const overflowClasses: Record<PanelOverflow, string> = {
  visible: 'overflow-visible',
  hidden: 'overflow-hidden',
  auto: 'overflow-auto',
};

export default function Panel({
  children,
  title,
  description,
  action,
  surface = 'glass',
  size = 'default',
  overflow = 'visible',
  as: Component = 'section',
  className = '',
  headerClassName = '',
  contentClassName = '',
}: PanelProps) {
  const hasHeader = title !== undefined || description !== undefined || action !== undefined;

  return (
    <Component
      className={`${surfaceClasses[surface]} ${sizeClasses[size]} ${overflowClasses[overflow]} ${className}`}
    >
      {hasHeader ? (
        <div className={`mb-5 flex items-start justify-between gap-4 ${headerClassName}`}>
          <div className="min-w-0">
            {title !== undefined ? <SectionTitle>{title}</SectionTitle> : null}
            {description !== undefined ? (
              <div className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{description}</div>
            ) : null}
          </div>
          {action !== undefined ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </Component>
  );
}
