import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@heroicons/react/24/outline';

type CompactMediaItemProps = {
  href: string;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export default function CompactMediaItem({
  href,
  title,
  description,
  trailing,
  className = '',
}: CompactMediaItemProps) {
  return (
    <Link
      href={href}
      className={`group surface-card-muted flex items-center justify-between gap-3 rounded-[20px] px-4 py-3 transition-all hover:border-[var(--color-airing)]/20 ${className}`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm text-[var(--text-primary)]">{title}</div>
        {description ? (
          <div className="truncate text-xs text-[var(--text-muted)]">{description}</div>
        ) : null}
      </div>
      <div className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--color-airing)]">
        {trailing ?? <ArrowUpRightIcon className="h-4 w-4" />}
      </div>
    </Link>
  );
}
