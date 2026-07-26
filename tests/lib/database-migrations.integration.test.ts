import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let migrationModule: typeof import('../../lib/database-migrations');
const openDatabases: Database.Database[] = [];
const temporaryDirectories: string[] = [];

beforeAll(async () => {
  migrationModule = await import('../../lib/database-migrations');
});

afterEach(() => {
  for (const database of openDatabases.splice(0)) {
    if (database.open) database.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  delete process.env.ANIMETRACK_BACKUPS_DIR;
});

afterAll(() => {
  delete process.env.ANIMETRACK_BACKUPS_DIR;
});

function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'animetrack-migration-test-'));
  const databasePath = join(directory, 'legacy.db');
  const backupsDirectory = join(directory, 'backups');
  const database = new Database(databasePath);

  temporaryDirectories.push(directory);
  openDatabases.push(database);
  process.env.ANIMETRACK_BACKUPS_DIR = backupsDirectory;

  return { database, databasePath, backupsDirectory };
}

function createLegacyAnimeTable(database: Database.Database) {
  database.exec(`
    CREATE TABLE anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      coverUrl TEXT,
      status TEXT NOT NULL
    );
  `);
}

describe('database migrations', () => {
  it('upgrades a legacy cover column after creating a pre-migration backup', () => {
    const { database, databasePath } = createTestDatabase();
    createLegacyAnimeTable(database);
    database.prepare(`
      INSERT INTO anime (title, coverUrl, status)
      VALUES
        ('本地封面', '/covers/1.jpg', 'watching'),
        ('远程封面', 'https://lain.bgm.tv/example.jpg', 'completed')
    `).run();

    const result = migrationModule.runDatabaseMigrations(database, databasePath);

    expect(result.applied).toEqual([21, 22]);
    expect(result.baselined).toEqual([2, 8, 11, 12, 15, 16, 17, 18, 19, 20]);
    expect(result.backupPath).not.toBeNull();
    expect(existsSync(result.backupPath!)).toBe(true);

    const rows = database.prepare(`
      SELECT title, coverUrl, localCoverUrl
      FROM anime
      ORDER BY id ASC
    `).all();
    expect(rows).toEqual([
      { title: '本地封面', coverUrl: null, localCoverUrl: '/covers/1.jpg' },
      {
        title: '远程封面',
        coverUrl: 'https://lain.bgm.tv/example.jpg',
        localCoverUrl: null,
      },
    ]);

    const backup = new Database(result.backupPath!, { readonly: true });
    const backupColumns = backup.pragma('table_info(anime)') as Array<{ name: string }>;
    const backupLocalCover = backup.prepare(`
      SELECT coverUrl FROM anime WHERE title = '本地封面'
    `).get() as { coverUrl: string };
    backup.close();

    expect(backupColumns.some((column) => column.name === 'localCoverUrl')).toBe(false);
    expect(backupLocalCover.coverUrl).toBe('/covers/1.jpg');
  });

  it('is idempotent when the same database starts again', () => {
    const { database, databasePath, backupsDirectory } = createTestDatabase();
    createLegacyAnimeTable(database);

    migrationModule.runDatabaseMigrations(database, databasePath);
    const backupCount = readdirSync(backupsDirectory).length;
    const secondRun = migrationModule.runDatabaseMigrations(database, databasePath);

    expect(secondRun).toEqual({
      applied: [],
      baselined: [],
      backupPath: null,
    });
    expect(readdirSync(backupsDirectory)).toHaveLength(backupCount);
  });

  it('records the cover migration as satisfied before applying newer migrations', () => {
    const { database, databasePath } = createTestDatabase();
    createLegacyAnimeTable(database);
    database.exec('ALTER TABLE anime ADD COLUMN localCoverUrl TEXT');

    const result = migrationModule.runDatabaseMigrations(database, databasePath);
    const migration = database.prepare(`
      SELECT execution_kind
      FROM schema_migrations
      WHERE version = 21
    `).get() as { execution_kind: string };

    expect(result.applied).toEqual([22]);
    expect(result.baselined).toContain(21);
    expect(result.backupPath).not.toBeNull();
    expect(migration.execution_kind).toBe('satisfied');
  });

  it('migrates an existing overall note into the structured notes table', () => {
    const { database, databasePath } = createTestDatabase();
    createLegacyAnimeTable(database);
    database.exec(`
      ALTER TABLE anime ADD COLUMN notes TEXT;
      ALTER TABLE anime ADD COLUMN createdAt TEXT;
      ALTER TABLE anime ADD COLUMN updatedAt TEXT;
    `);
    database.prepare(`
      INSERT INTO anime (title, status, notes, createdAt, updatedAt)
      VALUES ('带备注的番剧', 'completed', '第一行\n第二行', '2026-07-20T10:00:00.000Z', '2026-07-21T10:00:00.000Z')
    `).run();

    migrationModule.runDatabaseMigrations(database, databasePath);

    const note = database.prepare(`
      SELECT episode, content, notedAt
      FROM anime_notes
    `).get();
    expect(note).toEqual({
      episode: null,
      content: '第一行\n第二行',
      notedAt: '2026-07-21',
    });
  });

  it('rejects a changed checksum for a migration that was already recorded', () => {
    const { database, databasePath } = createTestDatabase();
    createLegacyAnimeTable(database);
    migrationModule.runDatabaseMigrations(database, databasePath);
    database.prepare(`
      UPDATE schema_migrations
      SET checksum = 'tampered'
      WHERE version = 21
    `).run();

    expect(() => migrationModule.runDatabaseMigrations(database, databasePath))
      .toThrow('校验和发生变化');
  });
});
