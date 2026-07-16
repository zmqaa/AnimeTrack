import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

type PageHeroProps = {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  backdrop?: ReactNode;
  className?: string;
  contentClassName?: string;
  copyClassName?: string;
  statsClassName?: string;
  align?: 'start' | 'end';
  layout?: 'horizontal' | 'stacked';
  spacing?: 'default' | 'roomy';
};

export default function PageHero({
  title,
  description,
  backHref,
  backLabel = '返回',
  actions,
  stats,
  backdrop,
  className = '',
  contentClassName = '',
  copyClassName = '',
  statsClassName = '',
  align = 'end',
  layout = 'horizontal',
  spacing = 'default',
}: PageHeroProps) {
  return (
    <section className={`page-hero ${className}`} data-layout={layout} data-spacing={spacing}>
      {backdrop ?? <div className="page-hero-backdrop" />}
      <div
        className={`page-hero-content ${
          align === 'start' ? 'lg:items-start' : 'lg:items-end'
        } ${contentClassName}`}
      >
        <div className={`page-hero-copy ${copyClassName}`}>
          {backHref ? (
            <Link href={backHref} className="page-hero-back-link">
              <ChevronLeftIcon className="h-4 w-4" />
              {backLabel}
            </Link>
          ) : null}
          <h1 className="page-hero-title">{title}</h1>
          {description ? <div className="page-hero-description">{description}</div> : null}
          {actions ? <div className="page-hero-actions">{actions}</div> : null}
        </div>
        {stats ? <div className={statsClassName}>{stats}</div> : null}
      </div>
    </section>
  );
}
