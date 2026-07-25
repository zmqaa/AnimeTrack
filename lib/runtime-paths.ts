import 'server-only';

import path from 'path';

function resolveConfiguredPath(value: string | undefined, fallback: string): string {
  const configured = String(value || '').trim();
  if (!configured) {
    return path.resolve(fallback);
  }

  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(process.cwd(), configured);
}

export function getDataDirectory(): string {
  return resolveConfiguredPath(
    process.env.ANIMETRACK_DATA_DIR,
    path.join(process.cwd(), 'data'),
  );
}

export function getDatabasePath(): string {
  return resolveConfiguredPath(
    process.env.DB_PATH,
    path.join(getDataDirectory(), 'animetrack.db'),
  );
}

export function getBackupsDirectory(): string {
  return resolveConfiguredPath(
    process.env.ANIMETRACK_BACKUPS_DIR,
    path.join(process.cwd(), 'backups'),
  );
}

export function getCoversDirectory(): string {
  return resolveConfiguredPath(
    process.env.ANIMETRACK_COVERS_DIR,
    path.join(process.cwd(), 'public', 'covers'),
  );
}

export function getProjectResourcePath(...segments: string[]): string {
  const resourcesRoot = resolveConfiguredPath(
    process.env.ANIMETRACK_RESOURCES_DIR,
    process.cwd(),
  );
  return path.join(resourcesRoot, ...segments);
}
