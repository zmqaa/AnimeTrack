/**
 * Environment variables used by the app.
 * Only DB_PATH is required for SQLite (defaults to data/animetrack.db).
 */
export const env = {
  dbPath: process.env.DB_PATH || 'data/animetrack.db',
} as const;
