import type { ReactNode } from 'react';

type StatTileSurface = 'muted' | 'card' | 'inset' | 'plain';
type StatTileSize = 'compact' | 'default';
type StatTileLayout = 'stacked' | 'split';

type StatTileProps = {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  surface?: StatTileSurface;
  size?: StatTileSize;
  layout?: StatTileLayout;
  className?: string;
};

const surfaceClasses: Record<StatTileSurface, string> = {
  muted: 'surface-card-muted',
  card: 'surface-card',
  inset: 'bg-[var(--color-surface-hover)]',
  plain: '',
};

export default function StatTile({
  label,
  value,
  unit,
  detail,
  surface = 'muted',
  size = 'default',
  layout = 'stacked',
  className = '',
}: StatTileProps) {
  return (
    <div
      className={`stat-tile ${surfaceClasses[surface]} ${className}`}
      data-layout={layout}
      data-size={size}
    >
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value-row">
        <span className="stat-tile-value">{value}</span>
        {unit !== undefined && unit !== '' ? <span className="stat-tile-unit">{unit}</span> : null}
      </div>
      {detail ? <div className="stat-tile-detail">{detail}</div> : null}
    </div>
  );
}
