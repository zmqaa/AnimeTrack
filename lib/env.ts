/**
 * Environment variables used by the app.
 * Only DB_PATH is required for SQLite (defaults to data/animetrack.db).
 */
import { getDatabasePath } from '@/lib/runtime-paths';

export const env = {
  get dbPath() {
    return getDatabasePath();
  },
} as const;
